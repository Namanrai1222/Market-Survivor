"""Market Survivor bronze bull and bear: low-poly statues for the Market City plaza, plus a hero render.

The animals are grown procedurally from a skeleton with Blender's Skin modifier, then subdivided into
smooth sculptural forms. Both face +X (the city rotates them to face each other).

  bull   a charging bull, head down, horns forward, tail whipped up
  bear   a hunched bear, one front paw raised to swipe

Usage (headless):
  Blender -b --factory-startup -P art/blender/bull_bear.py -- \
      --glb-dir apps/web/public/models --render apps/web/public/art/bull-bear.webp
"""

import argparse
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import realism  # noqa: E402  (shared Cycles + material detail pass)
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--glb-dir", default="")
ap.add_argument("--render", default="")
ap.add_argument("--width", type=int, default=1600)
ap.add_argument("--height", type=int, default=900)
ap.add_argument("--samples", type=int, default=96)
ap.add_argument("--target-tris", type=int, default=7000)
ap.add_argument("--cutout", default="", help="dir: transparent hero cut-outs bull-cutout.webp and bear-cutout.webp for the landing page")
args = ap.parse_args(argv)


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_lin(h, a=1.0):
    h = h.lstrip("#")
    return tuple(srgb_to_linear(int(h[i : i + 2], 16) / 255) for i in (0, 2, 4)) + (a,)


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------- Skeletons: name → (position, radius); edges by name ----------

def legs(prefix, pts):
    """A leg as a chain of (name, position, radius): muscle at the top, slender cannon bone, hoof/paw."""
    return {f"{prefix}{i}": (p, r) for i, (p, r) in enumerate(pts)}


def chain_edges(prefix, n, root):
    return [(root, f"{prefix}0")] + [(f"{prefix}{i}", f"{prefix}{i + 1}") for i in range(n - 1)]


# Charging bull, facing +X: massive shoulders and neck, head low, horns forward, tail whipped up.
BULL = {
    "tail3": ((-1.12, 0, 1.62), 0.035), "tail2": ((-0.9, 0, 1.36), 0.05), "tail1": ((-0.58, 0, 1.14), 0.08),
    "rump": ((-0.34, 0, 1.03), 0.5), "hips": ((0.02, 0, 1.02), 0.56), "mid": ((0.52, 0, 1.04), 0.63),
    "chest": ((1.0, 0, 1.12), 0.74), "hump": ((0.95, 0, 1.48), 0.5), "dewlap": ((1.2, 0, 0.7), 0.36),
    "neck": ((1.45, 0, 1.08), 0.52), "head": ((1.86, 0, 0.84), 0.35), "muzzle": ((2.16, 0, 0.64), 0.25), "nose": ((2.3, 0, 0.56), 0.21),
    "hornBL": ((1.84, 0.27, 1.02), 0.1), "hornML": ((1.95, 0.62, 1.1), 0.075), "hornTL": ((2.22, 0.74, 1.32), 0.025),
    "hornBR": ((1.84, -0.27, 1.02), 0.1), "hornMR": ((1.95, -0.62, 1.1), 0.075), "hornTR": ((2.22, -0.74, 1.32), 0.025),
    **legs("fl", [((1.1, 0.32, 0.86), 0.32), ((1.33, 0.32, 0.6), 0.18), ((1.5, 0.32, 0.44), 0.115), ((1.66, 0.32, 0.24), 0.085), ((1.8, 0.32, 0.09), 0.115), ((1.9, 0.32, 0.04), 0.11)]),
    **legs("fr", [((1.1, -0.32, 0.86), 0.32), ((1.2, -0.32, 0.6), 0.18), ((1.26, -0.32, 0.42), 0.115), ((1.27, -0.32, 0.22), 0.085), ((1.27, -0.32, 0.08), 0.12), ((1.36, -0.32, 0.04), 0.11)]),
    **legs("hl", [((-0.02, 0.33, 0.86), 0.4), ((-0.16, 0.33, 0.6), 0.22), ((-0.3, 0.33, 0.42), 0.11), ((-0.45, 0.33, 0.22), 0.085), ((-0.58, 0.33, 0.08), 0.115), ((-0.5, 0.33, 0.03), 0.11)]),
    **legs("hr", [((-0.02, -0.33, 0.86), 0.4), ((-0.08, -0.33, 0.6), 0.22), ((-0.12, -0.33, 0.42), 0.11), ((-0.16, -0.33, 0.22), 0.085), ((-0.2, -0.33, 0.08), 0.115), ((-0.1, -0.33, 0.03), 0.11)]),
}
BULL_EDGES = [
    ("tail3", "tail2"), ("tail2", "tail1"), ("tail1", "rump"), ("rump", "hips"), ("hips", "mid"), ("mid", "chest"),
    ("chest", "hump"), ("chest", "dewlap"), ("chest", "neck"), ("neck", "head"), ("head", "muzzle"), ("muzzle", "nose"),
    ("head", "hornBL"), ("hornBL", "hornML"), ("hornML", "hornTL"), ("head", "hornBR"), ("hornBR", "hornMR"), ("hornMR", "hornTR"),
    *chain_edges("fl", 6, "chest"), *chain_edges("fr", 6, "chest"), *chain_edges("hl", 6, "hips"), *chain_edges("hr", 6, "hips"),
]

# Hunched bear, facing +X: heavy shoulder hump, low head, right front paw raised to swipe.
BEAR = {
    "tail": ((-0.86, 0, 1.0), 0.12), "rump": ((-0.6, 0, 0.98), 0.56), "hips": ((-0.22, 0, 1.02), 0.64),
    "mid": ((0.28, 0, 1.08), 0.7), "shoulders": ((0.76, 0, 1.16), 0.68), "hump": ((0.7, 0, 1.5), 0.42),
    "neck": ((1.12, 0, 1.0), 0.48), "head": ((1.44, 0, 0.86), 0.4), "snout": ((1.74, 0, 0.78), 0.24), "nose": ((1.9, 0, 0.75), 0.14),
    "earL": ((1.36, 0.25, 1.2), 0.11), "earR": ((1.36, -0.25, 1.2), 0.11),
    **legs("fl", [((0.82, 0.36, 0.86), 0.34), ((0.86, 0.38, 0.5), 0.26), ((0.9, 0.38, 0.2), 0.21), ((0.98, 0.38, 0.08), 0.22), ((1.12, 0.38, 0.06), 0.2)]),
    **legs("fr", [((0.82, -0.36, 0.9), 0.34), ((1.12, -0.46, 0.74), 0.24), ((1.38, -0.5, 0.82), 0.21), ((1.55, -0.5, 0.86), 0.2), ((1.66, -0.5, 0.8), 0.16)]),
    **legs("hl", [((-0.26, 0.37, 0.84), 0.4), ((-0.34, 0.38, 0.5), 0.28), ((-0.3, 0.38, 0.2), 0.22), ((-0.22, 0.38, 0.08), 0.22), ((-0.08, 0.38, 0.06), 0.2)]),
    **legs("hr", [((-0.26, -0.37, 0.84), 0.4), ((-0.34, -0.38, 0.5), 0.28), ((-0.3, -0.38, 0.2), 0.22), ((-0.22, -0.38, 0.08), 0.22), ((-0.08, -0.38, 0.06), 0.2)]),
}
BEAR_EDGES = [
    ("tail", "rump"), ("rump", "hips"), ("hips", "mid"), ("mid", "shoulders"), ("shoulders", "hump"), ("shoulders", "neck"), ("neck", "head"),
    ("head", "snout"), ("snout", "nose"), ("head", "earL"), ("head", "earR"),
    *chain_edges("fl", 5, "shoulders"), *chain_edges("fr", 5, "shoulders"), *chain_edges("hl", 5, "hips"), *chain_edges("hr", 5, "hips"),
]


def bronze(name, tone="#8C5A2B"):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = hex_lin(tone)
    bsdf.inputs["Metallic"].default_value = 1.0
    bsdf.inputs["Roughness"].default_value = 0.34
    return m


def creature(name, skel, edges, material, resolution=0.028):
    """Grow a body from the skeleton with metaballs: blobs along every bone melt into one smooth, seamless
    surface (like a casting). Converted to a mesh and lightly smoothed."""
    mb = bpy.data.metaballs.new(name)
    mb.resolution = resolution
    mb.render_resolution = resolution
    mb.threshold = 0.6
    obj = bpy.data.objects.new(name, mb)
    scene.collection.objects.link(obj)
    for a, b in edges:
        (pa, ra), (pb, rb) = skel[a], skel[b]
        pa, pb = Vector(pa), Vector(pb)
        steps = max(2, int((pb - pa).length / (min(ra, rb) * 0.45)) + 1)
        for k in range(steps + 1):
            t = k / steps
            el = mb.elements.new()
            el.co = pa.lerp(pb, t)
            r = ra + (rb - ra) * t
            # Limbs, horns and tails need a little extra mass to fuse; the torso stays at its drawn size.
            el.radius = r * (1.2 if r < 0.25 else 1.0)
            el.stiffness = 2.0
    bpy.context.view_layer.objects.active = obj
    for o in scene.objects:
        o.select_set(o == obj)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    obj.name = name
    smooth = obj.modifiers.new("Smooth", "SMOOTH")
    smooth.factor = 0.5
    smooth.iterations = 6
    for poly in obj.data.polygons:
        poly.use_smooth = True
    obj.data.materials.append(material)
    return obj


bull = creature("Bull", BULL, BULL_EDGES, bronze("Bronze", "#8C5A2B"))
bear = creature("Bear", BEAR, BEAR_EDGES, bronze("DarkBronze", "#5E3F24"))


def export_glb(obj, path):
    """Apply modifiers, decimate to the triangle budget, and export one object as GLB (Y up)."""
    dup = obj.copy()
    dup.data = obj.data.copy()
    scene.collection.objects.link(dup)
    bpy.context.view_layer.objects.active = dup
    for o in scene.objects:
        o.select_set(o == dup)
    for mod in list(dup.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    tris = sum(len(p.vertices) - 2 for p in dup.data.polygons)
    if tris > args.target_tris:
        dec = dup.modifiers.new("Decimate", "DECIMATE")
        dec.ratio = args.target_tris / tris
        bpy.ops.object.modifier_apply(modifier=dec.name)
    for p in dup.data.polygons:
        p.use_smooth = True
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_materials="EXPORT", export_normals=True, export_texcoords=False)
    final = sum(len(p.vertices) - 2 for p in dup.data.polygons)
    bpy.data.objects.remove(dup, do_unlink=True)
    print(f"[bull_bear] wrote {path} ({final} tris)")


if args.glb_dir:
    os.makedirs(args.glb_dir, exist_ok=True)
    export_glb(bull, os.path.join(args.glb_dir, "bull.glb"))
    export_glb(bear, os.path.join(args.glb_dir, "bear.glb"))

def aged_bronze(name, bright="#C8914A", dark="#3A2212"):
    """Antique bronze for renders (Cycles): convex edges polished bright by hands and weather, recesses dark
    with a trace of green patina, roughness following the same wear. Driven by mesh curvature (pointiness)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Metallic"].default_value = 1.0
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    wear = nt.nodes.new("ShaderNodeValToRGB")
    wear.color_ramp.elements[0].position = 0.47
    wear.color_ramp.elements[1].position = 0.56
    nt.links.new(geo.outputs["Pointiness"], wear.inputs["Fac"])
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 9.0
    noise.inputs["Detail"].default_value = 8.0
    patina = nt.nodes.new("ShaderNodeMix")
    patina.data_type = "RGBA"
    patina.inputs["Factor"].default_value = 0.22
    patina.inputs[6].default_value = hex_lin(dark)
    patina.inputs[7].default_value = hex_lin("#35584A")
    nt.links.new(noise.outputs["Fac"], patina.inputs["Factor"])
    col = nt.nodes.new("ShaderNodeMix")
    col.data_type = "RGBA"
    nt.links.new(wear.outputs["Color"], col.inputs["Factor"])
    nt.links.new(patina.outputs[2], col.inputs[6])
    col.inputs[7].default_value = hex_lin(bright)
    nt.links.new(col.outputs[2], b.inputs["Base Color"])
    rough = nt.nodes.new("ShaderNodeMapRange")
    rough.inputs["To Min"].default_value = 0.55
    rough.inputs["To Max"].default_value = 0.2
    nt.links.new(wear.outputs["Color"], rough.inputs["Value"])
    nt.links.new(rough.outputs["Result"], b.inputs["Roughness"])
    return m


def cutouts(out_dir):
    """Each animal alone on a transparent background: low three-quarter hero angle, warm key, cool rim,
    and a shadow catcher so a soft contact shadow comes with it onto the web page."""
    os.makedirs(out_dir, exist_ok=True)
    scene.render.film_transparent = True
    scene.render.resolution_x, scene.render.resolution_y = 1800, 1350
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.quality = 88
    world = bpy.data.worlds.new("Studio")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = hex_lin("#1A2140")
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.5
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0))
    catcher = bpy.context.object
    catcher.is_shadow_catcher = True

    def area(loc, energy, color, size):
        bpy.ops.object.light_add(type="AREA", location=loc)
        o = bpy.context.object
        o.data.energy = energy
        o.data.color = hex_lin(color)[:3]
        o.data.size = size
        o.rotation_euler = (Vector((0.6, 0, 0.9)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        return o

    area((-3.5, -4.5, 4.5), 1400, "#FFD08A", 3.5)  # warm key, front left
    area((4.5, 3.0, 3.0), 3200, "#8C9CFF", 2.0)  # cool rim, back right
    area((-5.0, 2.5, 2.2), 1600, "#FFB866", 1.5)  # warm kicker, back left: outlines the far side
    area((0.5, 0, 6), 500, "#FFFFFF", 5.0)  # soft top
    bull.data.materials[0] = aged_bronze("AgedBronze")
    bear.data.materials[0] = aged_bronze("AgedDarkBronze", bright="#A8743D", dark="#2C190D")
    for animal, other, name, yaw in ((bull, bear, "bull", -14), (bear, bull, "bear", 196)):
        other.hide_render = True
        animal.hide_render = False
        animal.location = (0, 0, 0)
        animal.rotation_euler = (0, 0, math.radians(yaw))
        # Near-profile: a bull's charge reads from the side.
        bpy.ops.object.camera_add(location=(1.4, -8.2, 1.05))
        cam = bpy.context.object
        cam.data.lens = 55
        cam.rotation_euler = (Vector((0.55, 0, 0.9)) - cam.location).to_track_quat("-Z", "Y").to_euler()
        scene.camera = cam
        realism.finish(scene, 160, bump=0.06)
        scene.render.filepath = os.path.abspath(os.path.join(out_dir, f"{name}-cutout.webp"))
        bpy.ops.render.render(write_still=True)
        print(f"[bull_bear] cutout {scene.render.filepath}")


if args.cutout:
    cutouts(args.cutout)

if args.render:
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = args.samples
    if hasattr(scene.eevee, "use_raytracing"):
        scene.eevee.use_raytracing = True
    if hasattr(scene.eevee, "use_shadows"):
        scene.eevee.use_shadows = True
    scene.view_settings.view_transform = "Standard"
    scene.render.resolution_x, scene.render.resolution_y = args.width, args.height
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.quality = 86

    world = bpy.data.worlds.new("Night")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = hex_lin("#0B1020")
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6

    # Bull on the left facing right, bear on the right facing left: the standoff.
    bull.location = (-2.2, 0, 0.4)
    bull.rotation_euler = (0, 0, math.radians(8))
    bear.location = (2.2, 0, 0.4)
    bear.rotation_euler = (0, 0, math.radians(180 - 8))

    def box(name, loc, size, color, rough=0.5, emit=None, strength=0.0):
        bpy.ops.mesh.primitive_cube_add(location=loc)
        o = bpy.context.object
        o.name = name
        o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
        bev = o.modifiers.new("Bevel", "BEVEL")
        bev.width = 0.03
        bev.segments = 3
        m = bpy.data.materials.new(name + "Mat")
        m.use_nodes = True
        b = m.node_tree.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = hex_lin(color)
        b.inputs["Roughness"].default_value = rough
        if emit:
            b.inputs["Emission Color"].default_value = hex_lin(emit)
            b.inputs["Emission Strength"].default_value = strength
        o.data.materials.append(m)
        return o

    box("PedestalBull", (-2.0, 0, 0.2), (3.2, 1.6, 0.4), "#1B2033", 0.35)
    box("PedestalBear", (2.0, 0, 0.2), (3.0, 1.6, 0.4), "#1B2033", 0.35)
    # Wet stone plaza: low roughness so the lights reflect.
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0))
    floor = bpy.context.object
    fm = bpy.data.materials.new("Stone")
    fm.use_nodes = True
    fb = fm.node_tree.nodes["Principled BSDF"]
    fb.inputs["Base Color"].default_value = hex_lin("#0E1220")
    fb.inputs["Roughness"].default_value = 0.18
    floor.data.materials.append(fm)

    # Ticker wall behind: rows of glowing tiles in marigold, green and red.
    import random

    rnd = random.Random(7)
    for row in range(3):
        for col in range(30):
            c = rnd.choice(["#34C79A", "#34C79A", "#F2645A", "#F2A93B"])
            box(f"tick{row}_{col}", (-12.0 + col * 0.82, 9.0, 4.6 + row * 0.5), (0.66, 0.06, 0.34), "#05070D", 0.6, c, 0.8 + rnd.random() * 0.8)
    # Distant towers.
    for k in range(26):
        h = 2 + rnd.random() * 9
        x = -16 + k * 1.3 + rnd.random() * 0.5
        box(f"tower{k}", (x, 12 + rnd.random() * 6, h / 2), (1.0, 1.0, h), "#0E1322", 0.8)

    def spot(loc, target, energy, color, size_deg=38):
        bpy.ops.object.light_add(type="SPOT", location=loc)
        o = bpy.context.object
        o.data.energy = energy
        o.data.color = hex_lin(color)[:3]
        o.data.spot_size = math.radians(size_deg)
        o.data.spot_blend = 0.4
        o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()

    spot((-4.5, -4.0, 5.5), (-2.0, 0, 1.2), 2600, "#F2A93B")  # warm key on the bull
    spot((4.5, -4.0, 5.5), (2.0, 0, 1.2), 2100, "#F27A6A")  # red key on the bear
    spot((0, 5.0, 4.0), (0, 0, 1.0), 1500, "#7C8CF8", 70)  # blue rim from behind

    bpy.ops.object.camera_add(location=(0, -10.5, 1.9))
    cam = bpy.context.object
    cam.data.lens = 46
    cam.rotation_euler = (Vector((0, 0, 1.25)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.dof.use_dof = True
    cam.data.dof.focus_distance = 10.5
    cam.data.dof.aperture_fstop = 4.0
    scene.camera = cam
    os.makedirs(os.path.dirname(os.path.abspath(args.render)), exist_ok=True)
    realism.finish(scene, max(args.samples, 128), bump=0.06)
    scene.render.filepath = os.path.abspath(args.render)
    bpy.ops.render.render(write_still=True)
    print(f"[bull_bear] rendered {args.render}")
