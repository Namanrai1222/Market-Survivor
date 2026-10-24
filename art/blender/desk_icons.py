"""Market Survivor desk icons: one small 3D object per desk, same lighting and palette as the backdrop.

Bold silhouettes that still read at 20–24 px in the desk tabs; transparent WebP.

  world         a small monitor tiled with every asset-class colour ("every desk at a glance")
  stocks        three rising candlesticks
  ipo           the opening bell
  funds         a pie chart with one slice lifted out
  fixed_income  a safe with a dial
  commodities   stacked gold bars
  global        a globe with an orbit ring
  crypto        a coin with a hexagon face (no real crypto logos)
  prediction    a 62 / 38 probability ring

Usage (headless, renders all nine unless --only is given):
  Blender -b --factory-startup -P art/blender/desk_icons.py -- --out-dir apps/web/public/art/desks [--size 256] [--only stocks,ipo]
"""

import argparse
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out-dir", required=True)
ap.add_argument("--size", type=int, default=256)
ap.add_argument("--samples", type=int, default=64)
ap.add_argument("--only", default="")
args = ap.parse_args(argv)


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_lin(h, a=1.0):
    h = h.lstrip("#")
    return tuple(srgb_to_linear(int(h[i : i + 2], 16) / 255) for i in (0, 2, 4)) + (a,)


# design.md §2.3 asset-class colours
C = dict(
    marigold="#F2A93B", stocks="#7C8CF8", ipo="#A4AEFB", funds="#5CC8E6", fixed="#9AD18B",
    gold="#E3B341", global_="#C58AF0", crypto="#F07FB1", prediction="#6FD6C4", cash="#98A1BC",
    ink900="#0F1424", ink700="#1F2842", ink600="#2C3757", up="#34C79A", down="#F2645A",
)

# ---------------------------------------------------------------- scene (camera + lights persist across icons)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.eevee.taa_render_samples = args.samples
if hasattr(scene.eevee, "use_raytracing"):
    scene.eevee.use_raytracing = True
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.render.film_transparent = True
scene.render.resolution_x = scene.render.resolution_y = args.size
scene.render.image_settings.file_format = "WEBP"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.quality = 90

world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = hex_lin("#2A3354")
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8


def light(kind, loc, energy, color="#FFFFFF", size=2.0, target=(0, 0, 0)):
    bpy.ops.object.light_add(type=kind, location=loc)
    o = bpy.context.object
    o.data.energy = energy
    o.data.color = hex_lin(color)[:3]
    if kind == "AREA":
        o.data.size = size
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    o["keep"] = True
    return o


light("AREA", (-2.5, -3.0, 4.0), 480, "#FFF4E2", 3.0)  # warm key (desk lamp side)
light("AREA", (3.5, -1.0, 1.0), 120, "#9FB2FF", 3.0)  # cool fill (screens)
light("AREA", (0.5, 3.5, 2.5), 500, "#FFFFFF", 2.0)  # rim for a crisp silhouette on dark tabs

bpy.ops.object.camera_add(location=(4.2, -4.2, 3.6))
cam = bpy.context.object
cam["keep"] = True
cam.data.type = "ORTHO"
cam.data.ortho_scale = 2.7
cam.rotation_euler = (Vector((0, 0, 0.05)) - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

# ---------------------------------------------------------------- helpers

_mats = {}


def mat(color, metal=0.0, rough=0.45, emit=0.12):
    key = (color, metal, rough, emit)
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(color)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = hex_lin(color)
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rough
    # A touch of self-light keeps the class colour true on dark UI even on the shadow side.
    p.inputs["Emission Color"].default_value = hex_lin(color)
    p.inputs["Emission Strength"].default_value = emit
    _mats[key] = m
    return m


def finish(o, m, bevel=0.03, smooth=False):
    o.data.materials.append(m)
    if bevel:
        b = o.modifiers.new("bevel", "BEVEL")
        b.width = bevel
        b.segments = 3
        b.limit_method = "ANGLE"
    if smooth:
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.shade_smooth()
    return o


def box(loc, size, m, rot=(0, 0, 0), bevel=0.03):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, m, bevel)


def cyl(loc, r, depth, m, rot=(0, 0, 0), verts=48, bevel=0.02):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    return finish(bpy.context.object, m, bevel, smooth=verts > 8)


def sphere(loc, r, m, seg=48):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=r, location=loc)
    return finish(bpy.context.object, m, 0, smooth=True)


def torus(loc, R, r, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc, rotation=rot, major_segments=64, minor_segments=16)
    return finish(bpy.context.object, m, 0, smooth=True)


def mesh_object(name, bm, m, bevel=0.025, smooth=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    return finish(o, m, bevel, smooth)


def hull(name, pts, m, bevel=0.025):
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in pts]
    bmesh.ops.convex_hull(bm, input=vs)
    return mesh_object(name, bm, m, bevel)


def ring_wedge(name, a0, a1, r_in, r_out, h, z0, m, seg=48):
    """Annulus (or pie, r_in = 0) sector from angle a0 to a1, extruded by h."""
    bm = bmesh.new()
    n = max(2, int(seg * abs(a1 - a0) / (2 * math.pi)) + 1)
    outer = [bm.verts.new((r_out * math.cos(a0 + (a1 - a0) * i / (n - 1)), r_out * math.sin(a0 + (a1 - a0) * i / (n - 1)), z0)) for i in range(n)]
    if r_in > 0:
        inner = [bm.verts.new((r_in * math.cos(a0 + (a1 - a0) * i / (n - 1)), r_in * math.sin(a0 + (a1 - a0) * i / (n - 1)), z0)) for i in reversed(range(n))]
    else:
        inner = [bm.verts.new((0, 0, z0))]
    face = bm.faces.new(outer + inner)
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    top = [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=top, vec=(0, 0, h))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_object(name, bm, m)


def fit_camera(margin=0.08):
    """Frame the icon tightly: project every evaluated vertex into camera space, centre and scale to fit."""
    dg = bpy.context.evaluated_depsgraph_get()
    inv = cam.matrix_world.inverted()
    xs, ys = [], []
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        for v in me.vertices:
            p = inv @ (ev.matrix_world @ v.co)
            xs.append(p.x)
            ys.append(p.y)
        ev.to_mesh_clear()
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    scale = max(w, h) * (1 + 2 * margin)
    cam.data.ortho_scale = scale
    cam.data.shift_x = ((max(xs) + min(xs)) / 2) / scale
    cam.data.shift_y = ((max(ys) + min(ys)) / 2) / scale


def clear():
    for o in list(bpy.data.objects):
        if not o.get("keep"):
            bpy.data.objects.remove(o, do_unlink=True)


# ---------------------------------------------------------------- icons


def icon_world():
    ink, gold = mat(C["ink700"], rough=0.35, emit=0.0), mat(C["marigold"], metal=0.3, rough=0.35)
    box((0, 0, 0.45), (1.75, 0.14, 1.12), ink, bevel=0.06)  # bezel
    cols = [C["stocks"], C["funds"], C["fixed"], C["gold"], C["global_"], C["crypto"]]
    for i, col in enumerate(cols):  # one tile per asset class
        x, z = -0.5 + (i % 3) * 0.5, 0.68 - (i // 3) * 0.46
        box((x, -0.09, z), (0.42, 0.06, 0.38), mat(col, emit=0.45, rough=0.3), bevel=0.02)
    box((0, 0.05, -0.32), (0.16, 0.12, 0.45), gold)  # stand
    box((0, 0.0, -0.56), (0.9, 0.5, 0.08), gold, bevel=0.035)


def icon_stocks():
    base, light_ = mat(C["stocks"]), mat("#AEB8FF", emit=0.2)
    for i, (h, z) in enumerate(((0.55, -0.35), (0.8, -0.05), (1.05, 0.3))):
        x = -0.62 + i * 0.62
        box((x, 0, z), (0.36, 0.36, h), base if i < 2 else light_, bevel=0.05)
        cyl((x, 0, z + h / 2 + 0.17), 0.045, 0.34, base if i < 2 else light_, verts=16, bevel=0)
        cyl((x, 0, z - h / 2 - 0.12), 0.045, 0.24, base if i < 2 else light_, verts=16, bevel=0)


def icon_ipo():
    b, gold = mat(C["ipo"], metal=0.5, rough=0.3), mat(C["marigold"], metal=0.6, rough=0.3)
    bpy.ops.mesh.primitive_cone_add(vertices=64, radius1=0.78, radius2=0.32, depth=0.95, location=(0, 0, 0.0))
    finish(bpy.context.object, b, 0.04, smooth=True)
    sphere((0, 0, 0.47), 0.33, b)
    torus((0, 0, -0.48), 0.78, 0.07, b)
    sphere((0, 0, -0.66), 0.14, gold)  # clapper
    torus((0, 0, 0.86), 0.12, 0.04, gold, rot=(math.radians(90), 0, math.radians(45)))  # hanging loop


def icon_funds():
    shades = (C["funds"], "#2E8FB0", "#7FD4EC", "#1F6F8C")
    cuts = (0.0, 2.1, 3.7, 5.0, 2 * math.pi)
    for i in range(4):
        a0, a1 = cuts[i], cuts[i + 1]
        lift = 0.22 if i == 0 else 0.0  # the lifted slice: "your SIP"
        mid = (a0 + a1) / 2
        o = ring_wedge(f"slice{i}", a0, a1, 0.0, 1.0, 0.32, -0.16, mat(shades[i], emit=0.18))
        o.location = (lift * math.cos(mid), lift * math.sin(mid), 0.1 if i == 0 else 0.0)
    for o in bpy.data.objects:
        if o.name.startswith("slice"):
            o.rotation_euler = (math.radians(0), 0, math.radians(-25))


def icon_fixed_income():
    body, dark, gold = mat(C["fixed"]), mat("#5F9A55"), mat(C["marigold"], metal=0.6, rough=0.3)
    box((0, 0, 0), (1.45, 1.2, 1.35), body, bevel=0.1)
    box((0, -0.62, 0), (1.15, 0.06, 1.05), dark, bevel=0.04)  # door
    cyl((-0.12, -0.7, 0.05), 0.27, 0.1, gold, rot=(math.radians(90), 0, 0))  # dial
    for k in range(8):
        a = k * math.pi / 4
        box((-0.12 + 0.2 * math.cos(a), -0.76, 0.05 + 0.2 * math.sin(a)), (0.03, 0.03, 0.03), dark, bevel=0)
    box((0.36, -0.72, 0.05), (0.08, 0.1, 0.42), gold, bevel=0.03)  # handle
    for x in (-0.5, 0.5):
        box((x, 0, -0.74), (0.22, 0.9, 0.14), dark, bevel=0.03)  # feet


def icon_commodities():
    g = mat(C["gold"], metal=0.85, rough=0.25, emit=0.08)

    def ingot(cx, cy, cz):
        L, W, H, l, w = 1.0, 0.5, 0.3, 0.8, 0.32
        pts = [(cx + sx * L / 2, cy + sy * W / 2, cz) for sx in (-1, 1) for sy in (-1, 1)]
        pts += [(cx + sx * l / 2, cy + sy * w / 2, cz + H) for sx in (-1, 1) for sy in (-1, 1)]
        hull("ingot", pts, g, bevel=0.03)

    ingot(-0.27, -0.3, -0.5)
    ingot(0.27, 0.3, -0.5)
    ingot(-0.27, 0.3, -0.5)
    ingot(0.27, -0.3, -0.5)
    ingot(0.0, 0.0, -0.2)


def icon_global():
    g, ring = mat(C["global_"], rough=0.4), mat("#E2C6F8", metal=0.4, rough=0.3, emit=0.25)
    sphere((0, 0, 0), 0.78, g)
    for tilt in (0, 60, 120):  # meridians
        torus((0, 0, 0), 0.785, 0.025, mat("#9B63C9", emit=0.0), rot=(math.radians(90), 0, math.radians(tilt)))
    for z, R in ((0.0, 0.785), (0.42, 0.66), (-0.42, 0.66)):  # parallels
        torus((0, 0, z), R, 0.025, mat("#9B63C9", emit=0.0))
    torus((0, 0, 0), 1.1, 0.045, ring, rot=(math.radians(68), math.radians(18), 0))  # orbit
    sphere((1.02, -0.2, 0.36), 0.09, mat(C["marigold"], emit=0.6))


def icon_crypto():
    coin, face = mat(C["crypto"], metal=0.55, rough=0.3), mat("#FFB3D4", metal=0.4, rough=0.3, emit=0.25)
    rot = (math.radians(72), 0, math.radians(20))
    o = cyl((0, 0, 0), 0.95, 0.2, coin, rot=rot, verts=64, bevel=0.05)
    hexo = cyl((0, 0, 0), 0.5, 0.26, face, rot=rot, verts=6, bevel=0.03)
    inner = cyl((0, 0, 0), 0.24, 0.3, coin, rot=rot, verts=6, bevel=0.02)
    for ob in (hexo, inner):
        ob.rotation_mode = "XYZ"


def icon_prediction():
    yes, no = mat(C["prediction"], emit=0.3), mat(C["ink600"], emit=0.0, rough=0.5)
    split = 2 * math.pi * 0.62
    start = math.radians(90)
    ring_wedge("yes", start, start + split, 0.52, 1.0, 0.42, -0.21, yes)
    ring_wedge("no", start + split + 0.06, start + 2 * math.pi - 0.06, 0.52, 1.0, 0.22, -0.21, no)
    cyl((0, 0, -0.11), 0.3, 0.2, mat(C["marigold"], metal=0.4, rough=0.3), verts=48)  # centre hub


ICONS = dict(
    world=icon_world, stocks=icon_stocks, ipo=icon_ipo, funds=icon_funds, fixed_income=icon_fixed_income,
    commodities=icon_commodities, global_=icon_global, crypto=icon_crypto, prediction=icon_prediction,
)

os.makedirs(args.out_dir, exist_ok=True)
only = {s.strip() for s in args.only.split(",") if s.strip()}
for name, build in ICONS.items():
    file = name.rstrip("_")
    if only and file not in only:
        continue
    clear()
    build()
    fit_camera()
    scene.render.filepath = os.path.join(args.out_dir, f"{file}.webp")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", file)
