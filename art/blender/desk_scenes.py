"""Market Survivor desk hero scenes: one photographic still per desk, shown as the banner at the top of it.

Each scene is a small set on a dark glossy floor, lit like a product shot: warm key, cool fill and a rim
in the desk's class colour. Objects sit in the right half so the desk title can sit on the left.

  stocks        glass candlesticks rising on a marble slab
  ipo           a brass listing bell on a wooden stand, with its mallet
  funds         a glass jar of coins beside growing coin stacks and a sprout
  fixed_income  a steel vault door with bond certificates
  commodities   a pyramid of gold bars, a silver bar and an oil barrel
  global        a night-side globe with glowing trade routes
  crypto        a fictional embossed coin with a hardware wallet (no real logos)
  prediction    a brass armillary sphere around a glowing core

Usage (headless; all scenes unless --only):
  Blender -b --factory-startup -P art/blender/desk_scenes.py -- --out-dir apps/web/public/art/scenes [--only crypto]
"""

import argparse
import math
import os
import random
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import realism  # noqa: E402  (shared Cycles + material detail pass)
import bmesh
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out-dir", required=True)
ap.add_argument("--width", type=int, default=1800)
ap.add_argument("--height", type=int, default=560)
ap.add_argument("--samples", type=int, default=64)
ap.add_argument("--only", default="")
args = ap.parse_args(argv)


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def lin(h, a=1.0):
    h = h.lstrip("#")
    return tuple(srgb_to_linear(int(h[i : i + 2], 16) / 255) for i in (0, 2, 4)) + (a,)


CLASS = dict(stocks="#7C8CF8", ipo="#F2A93B", funds="#5CC8E6", fixed_income="#9AD18B", commodities="#E3B341", global_="#C58AF0", crypto="#F07FB1", prediction="#6FD6C4")

# ---------- scene plumbing ----------


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.eevee.taa_render_samples = args.samples
    if hasattr(sc.eevee, "use_raytracing"):
        sc.eevee.use_raytracing = True
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.render.resolution_x, sc.render.resolution_y = args.width, args.height
    sc.render.image_settings.file_format = "WEBP"
    sc.render.image_settings.quality = 84
    w = bpy.data.worlds.new("W")
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = lin("#0C1122")
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35
    return sc


def mat(name, color, metal=0.0, rough=0.5, emit=None, strength=0.0, transmission=0.0, ior=1.45, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = lin(color)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    if transmission:
        b.inputs["Transmission Weight"].default_value = transmission
        b.inputs["IOR"].default_value = ior
    if coat:
        b.inputs["Coat Weight"].default_value = coat
    if emit:
        b.inputs["Emission Color"].default_value = lin(emit)
        b.inputs["Emission Strength"].default_value = strength
    return m


def put(obj, material, smooth=True, bevel=0.0, segments=3):
    if material:
        obj.data.materials.clear()
        obj.data.materials.append(material)
    if bevel:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
    if smooth and hasattr(obj.data, "polygons"):
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def cube(loc, size, material, bevel=0.02, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    return put(o, material, smooth=False, bevel=bevel)


def cyl(loc, r, depth, material, verts=64, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    return put(bpy.context.object, material, smooth=True, bevel=bevel)


def sphere(loc, r, material, seg=64):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=r, location=loc)
    return put(bpy.context.object, material)


def torus(loc, major, minor, material, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(location=loc, rotation=rot, major_radius=major, minor_radius=minor, major_segments=96, minor_segments=24)
    return put(bpy.context.object, material)


def lathe(profile, material, loc=(0, 0, 0), steps=96):
    """Spin a (radius, z) profile around Z into a solid (bells, jars, barrels)."""
    mesh = bpy.data.meshes.new("lathe")
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        ring = [bm.verts.new((r * math.cos(2 * math.pi * k / steps), r * math.sin(2 * math.pi * k / steps), z)) for k in range(steps)]
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for k in range(steps):
            bm.faces.new((a[k], a[(k + 1) % steps], b[(k + 1) % steps], b[k]))
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    o = bpy.data.objects.new("lathe", mesh)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    return put(o, material)


def floor(color="#0B0F1C", rough=0.16):
    bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, 0))
    return put(bpy.context.object, mat("Floor", color, rough=rough), smooth=False)


def area(loc, target, energy, color, size):
    bpy.ops.object.light_add(type="AREA", location=loc)
    o = bpy.context.object
    o.data.energy = energy
    o.data.color = lin(color)[:3]
    o.data.size = size
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return o


def studio(accent, focus=(2.6, 0, 0.8)):
    """Warm key from the front left, cool fill, coloured rim behind, and a soft top light."""
    f = Vector(focus)
    area(f + Vector((-3.5, -4.0, 4.0)), f, 900, "#FFF1DC", 3.0)
    area(f + Vector((4.0, -2.5, 1.5)), f, 260, "#9FB2FF", 3.0)
    area(f + Vector((0.5, 4.5, 2.8)), f, 1300, accent, 2.0)
    area(f + Vector((0, 0, 6)), f, 300, "#FFFFFF", 4.0)


def camera(target=(2.6, 0, 0.8), subject_h=1.6, lens=35, elev=0.18, side=-0.12, shift=-0.2):
    """Frame the subject to ~70% of the wide frame's height and push it right with lens shift (title room left)."""
    t = Vector(target)
    sensor_v = 36 * args.height / args.width
    dist = (subject_h / 0.7 / 2) / (sensor_v / 2 / lens)
    d = Vector((side, -1.0, elev)).normalized() * dist
    loc = t + d
    bpy.ops.object.camera_add(location=loc)
    cam = bpy.context.object
    cam.data.lens = lens
    cam.data.sensor_fit = "HORIZONTAL"
    cam.data.shift_x = shift
    cam.rotation_euler = (t - loc).to_track_quat("-Z", "Y").to_euler()
    cam.data.dof.use_dof = True
    cam.data.dof.focus_distance = dist
    cam.data.dof.aperture_fstop = 5.6
    cam.data.clip_end = 400
    bpy.context.scene.camera = cam


def render(name):
    sc = bpy.context.scene
    realism.finish(sc, max(args.samples, 96))
    path = os.path.abspath(os.path.join(args.out_dir, f"{name}.webp"))
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print(f"[desk_scenes] {name} -> {path}")


# ---------- shared materials ----------


def gold():
    return mat("Gold", "#E8B04A", metal=1.0, rough=0.22)


def brass():
    return mat("Brass", "#C9973F", metal=1.0, rough=0.3)


def steel(rough=0.32):
    return mat("Steel", "#B9C0CC", metal=1.0, rough=rough)


def marble():
    return mat("Marble", "#151A2B", rough=0.12, coat=0.6)


# ---------- scenes ----------


def scene_stocks():
    reset()
    floor()
    cube((2.6, 0, 0.09), (4.6, 1.6, 0.18), marble(), bevel=0.03)
    up = mat("UpGlass", "#34C79A", rough=0.08, transmission=0.6, emit="#34C79A", strength=1.6)
    down = mat("DownGlass", "#E5484D", rough=0.08, transmission=0.6, emit="#E5484D", strength=1.2)
    wick = mat("Wick", "#D7DCEA", metal=1.0, rough=0.25)
    rnd = random.Random(4)
    base = 0.55
    for k in range(9):
        x = 0.7 + k * 0.48
        rising = rnd.random() > 0.3
        body = 0.25 + rnd.random() * 0.45
        lo = base + (0.0 if rising else -body)
        cube((x, 0, 0.18 + lo + body / 2 + 0.05), (0.26, 0.26, body), up if rising else down, bevel=0.015)
        cyl((x, 0, 0.18 + lo + body / 2 + 0.05), 0.018, body + 0.35 + rnd.random() * 0.2, wick, verts=16)
        base += 0.16 if rising else -0.08
    studio(CLASS["stocks"], (2.6, 0, 1.0))
    camera((2.6, 0, 0.85), subject_h=1.9)
    render("stocks")


def scene_ipo():
    reset()
    floor()
    wood = mat("Walnut", "#4A2E1C", rough=0.45)
    # stand: two posts and a beam
    for x in (1.7, 3.5):
        cube((x, 0, 1.15), (0.16, 0.16, 2.3), wood, bevel=0.02)
    cube((2.6, 0, 2.28), (2.15, 0.2, 0.16), wood, bevel=0.02)
    cube((2.6, 0, 0.05), (2.6, 0.9, 0.1), wood, bevel=0.02)
    # the bell: a lathed brass profile hanging from the beam
    prof = [(0.0, 2.1), (0.12, 2.1), (0.18, 2.0), (0.24, 1.82), (0.3, 1.6), (0.4, 1.42), (0.56, 1.28), (0.6, 1.24), (0.58, 1.22), (0.5, 1.26), (0.36, 1.36), (0.0, 1.5)]
    bell = lathe(prof, brass(), loc=(2.6, 0, 0))
    sub = bell.modifiers.new("Sub", "SUBSURF")
    sub.levels = 1
    cyl((2.6, 0, 2.17), 0.03, 0.12, brass(), verts=16)
    sphere((2.6, 0, 1.22), 0.07, brass())
    # mallet resting on the base
    cyl((3.3, -0.3, 0.16), 0.03, 0.9, wood, verts=24, rot=(0, math.radians(90), math.radians(30)))
    cyl((3.68, -0.08, 0.16), 0.09, 0.22, mat("Felt", "#7A1F2A", rough=0.9), verts=32, rot=(math.radians(90), 0, math.radians(30)))
    studio(CLASS["ipo"], (2.6, 0, 1.3))
    camera((2.6, 0, 1.2), subject_h=2.6, elev=0.08)
    render("ipo")


def scene_funds():
    reset()
    floor()
    glass = mat("Glass", "#E6F4F8", rough=0.03, transmission=1.0, ior=1.48)
    jar = lathe([(0.0, 0.02), (0.55, 0.02), (0.6, 0.08), (0.62, 1.1), (0.5, 1.25), (0.42, 1.3), (0.42, 1.38)], glass, loc=(3.0, 0.1, 0))
    sol = jar.modifiers.new("Solid", "SOLIDIFY")
    sol.thickness = 0.03
    cyl((3.0, 0.1, 1.42), 0.45, 0.08, mat("Lid", "#5CC8E6", metal=0.6, rough=0.3), verts=64)
    coin = gold()
    rnd = random.Random(11)
    for k in range(26):  # coins tumbling inside the jar
        a = rnd.random() * math.tau
        rr = rnd.random() * 0.4
        cyl((3.0 + rr * math.cos(a), 0.1 + rr * math.sin(a), 0.08 + k * 0.035), 0.16, 0.03, coin, verts=48, rot=(rnd.random() * 0.5, rnd.random() * 0.5, 0))
    for i, n in enumerate((4, 8, 13, 19)):  # growing stacks: the SIP story
        for j in range(n):
            cyl((1.1 + i * 0.42, -0.45, 0.02 + j * 0.036), 0.15, 0.032, coin, verts=48)
    leaf = mat("Leaf", "#4FBF6A", rough=0.45)
    stem = cyl((2.36, -0.45, 0.85), 0.012, 0.32, leaf, verts=12)
    for s in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.1, location=(2.36 + s * 0.09, -0.45, 1.02))
        lf = bpy.context.object
        lf.scale = (1.0, 0.35, 0.18)
        lf.rotation_euler = (0, s * -0.5, 0)
        put(lf, leaf)
    del stem
    studio(CLASS["funds"], (2.5, 0, 0.75))
    camera((2.5, 0, 0.7), subject_h=1.7)
    render("funds")


def scene_fixed_income():
    reset()
    floor()
    st = steel(0.28)
    dark = mat("Gunmetal", "#4B5262", metal=1.0, rough=0.35)
    # the vault door, standing slightly open toward the camera
    door = cyl((3.1, 0.2, 1.25), 1.1, 0.32, st, verts=96, rot=(math.radians(90), 0, math.radians(-25)), bevel=0.03)
    torus((3.1, 0.2, 1.25), 1.17, 0.07, dark, rot=(math.radians(90), 0, math.radians(-25)))
    rot = math.radians(-25)
    fx = Vector((math.cos(rot), math.sin(rot), 0))
    nrm = Vector((math.sin(rot), -math.cos(rot), 0))
    center = Vector((3.1, 0.2, 1.25)) + nrm * 0.2
    torus(tuple(center + nrm * 0.12), 0.42, 0.04, dark, rot=(math.radians(90), 0, rot))  # handle wheel
    for k in range(6):
        a = k * math.pi / 3
        p = center + nrm * 0.12 + fx * (0.21 * math.cos(a)) + Vector((0, 0, 0.21 * math.sin(a)))
        cyl(tuple(p), 0.022, 0.42, dark, verts=16, rot=(0, math.pi / 2 - a, rot))
    cyl(tuple(center + nrm * 0.14), 0.09, 0.14, dark, verts=32, rot=(math.radians(90), 0, rot))
    for k in range(16):  # locking bolts around the rim
        a = k * math.tau / 16
        p = Vector((3.1, 0.2, 1.25)) + fx * (0.95 * math.cos(a)) + Vector((0, 0, 0.95 * math.sin(a))) + nrm * 0.17
        cyl(tuple(p), 0.045, 0.04, st, verts=24, rot=(math.radians(90), 0, rot))
    paper = mat("Paper", "#E9E1C8", rough=0.7)
    band = mat("GoldFoil", "#D9A441", metal=1.0, rough=0.3)
    for k in range(7):  # a stack of bond certificates
        cube((1.35, -0.55, 0.02 + k * 0.022), (0.95, 0.66, 0.018), paper, bevel=0.002, rot=(0, 0, math.radians(8 + k * 2)))
    cube((1.35, -0.55, 0.18), (0.98, 0.1, 0.012), band, bevel=0.002, rot=(0, 0, math.radians(20)))
    studio(CLASS["fixed_income"], (2.6, 0, 1.0))
    camera((2.3, 0, 1.15), subject_h=2.6, elev=0.08)
    render("fixed_income")


def bar(loc, material, rot=0.0, size=(0.62, 0.28, 0.17)):
    """A cast bullion bar: the top face smaller than the base."""
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=(0, 0, rot))
    o = bpy.context.object
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    for v in bm.verts:
        if v.co.z > 0:
            v.co.x *= 0.82
            v.co.y *= 0.72
    bm.to_mesh(o.data)
    bm.free()
    return put(o, material, smooth=False, bevel=0.012)


def scene_commodities():
    reset()
    floor()
    g = gold()
    cube((2.4, -0.1, 0.06), (3.4, 1.6, 0.12), marble(), bevel=0.03)  # a slab lifts the bars off their reflection
    for row, n in enumerate((4, 3, 2, 1)):
        for k in range(n):
            bar((2.2 + (k - (n - 1) / 2) * 0.66, 0, 0.12 + 0.085 + row * 0.17), g)
    bar((3.55, -0.55, 0.12 + 0.085), mat("Silver", "#D5D9E2", metal=1.0, rough=0.2), rot=math.radians(-20))
    paint = mat("BarrelPaint", "#1E3A5F", metal=0.3, rough=0.4)
    rim = mat("BarrelRim", "#2A4D78", metal=0.5, rough=0.35)
    cyl((4.25, 0.45, 0.55), 0.38, 1.1, paint, verts=64)
    for z in (0.05, 0.38, 0.72, 1.05):
        torus((4.25, 0.45, z), 0.385, 0.02, rim)
    cyl((4.25, 0.45, 0.55), 0.386, 0.12, mat("Band", "#E7E2D3", rough=0.5), verts=64)
    studio(CLASS["commodities"], (2.8, 0, 0.6))
    camera((2.9, 0, 0.5), subject_h=1.5, elev=0.22)
    render("commodities")


def scene_global():
    reset()
    floor()
    # night-side globe: dark ocean, warm city-light speckle on noisy land masses
    globe = mat("Globe", "#0E2240", rough=0.35)
    nt = globe.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 2.2
    noise.inputs["Detail"].default_value = 6
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.52
    ramp.color_ramp.elements[0].color = lin("#0E2240")
    ramp.color_ramp.elements[1].position = 0.55
    ramp.color_ramp.elements[1].color = lin("#2D4A3A")
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    lights = nt.nodes.new("ShaderNodeTexNoise")
    lights.inputs["Scale"].default_value = 60
    lr = nt.nodes.new("ShaderNodeValToRGB")
    lr.color_ramp.elements[0].position = 0.68
    lr.color_ramp.elements[0].color = (0, 0, 0, 1)
    lr.color_ramp.elements[1].position = 0.72
    lr.color_ramp.elements[1].color = lin("#FFC46B")
    mult = nt.nodes.new("ShaderNodeMix")
    mult.data_type = "RGBA"
    mult.blend_type = "MULTIPLY"
    mult.inputs["Factor"].default_value = 1.0
    nt.links.new(lights.outputs["Fac"], lr.inputs["Fac"])
    nt.links.new(lr.outputs["Color"], mult.inputs[6])
    nt.links.new(ramp.outputs["Color"], mult.inputs[7])
    nt.links.new(mult.outputs[2], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 6.0
    sphere((2.9, 0, 1.45), 0.95, globe, seg=96)
    b = brass()
    torus((2.9, 0, 1.45), 1.06, 0.025, b, rot=(0, math.radians(23), math.radians(90)))
    cyl((2.9, 0, 0.06), 0.55, 0.12, mat("Base", "#151A2B", metal=0.4, rough=0.3), verts=64, bevel=0.02)
    cyl((2.9, 0, 0.3), 0.05, 0.42, b, verts=24)
    # glowing trade routes: arcs above the surface
    route = mat("Route", "#F2A93B", emit="#F2A93B", strength=8)
    rnd = random.Random(3)
    for _ in range(5):
        a1, a2 = rnd.uniform(-1.8, 0.4), rnd.uniform(-1.8, 0.4)
        e1, e2 = rnd.uniform(-0.6, 0.8), rnd.uniform(-0.6, 0.8)
        pts = []
        for i in range(25):
            t = i / 24
            a = a1 + (a2 - a1) * t
            e = e1 + (e2 - e1) * t
            r = 0.96 + 0.22 * math.sin(math.pi * t)
            pts.append(Vector((2.9 + r * math.cos(e) * math.cos(a), r * math.cos(e) * math.sin(a), 1.45 + r * math.sin(e))))
        cd = bpy.data.curves.new("route", "CURVE")
        cd.dimensions = "3D"
        cd.bevel_depth = 0.008
        sp = cd.splines.new("POLY")
        sp.points.add(len(pts) - 1)
        for p, v in zip(sp.points, pts):
            p.co = (v.x, v.y, v.z, 1)
        o = bpy.data.objects.new("route", cd)
        bpy.context.scene.collection.objects.link(o)
        o.data.materials.append(route)
    studio(CLASS["global_"], (2.9, 0, 1.3))
    camera((2.9, 0, 1.25), subject_h=2.8, elev=0.06)
    render("global")


def scene_crypto():
    reset()
    floor()
    g = mat("CoinGold", "#E0A93A", metal=1.0, rough=0.2)
    face = mat("CoinFace", "#C88E2A", metal=1.0, rough=0.35)
    # the hero coin, standing on its edge
    rot = (math.radians(90), 0, math.radians(-18))
    cyl((2.9, 0.2, 0.95), 0.92, 0.12, g, verts=128, rot=rot, bevel=0.02)
    torus((2.9, 0.2, 0.95), 0.8, 0.025, face, rot=rot)
    nrm = Vector((math.sin(rot[2]), -math.cos(rot[2]), 0))
    c = Vector((2.9, 0.2, 0.95)) + nrm * 0.065
    cyl(tuple(c), 0.36, 0.04, face, verts=6, rot=rot, bevel=0.01)  # a hexagon emblem: no real coin's mark
    for k in range(48):  # milled edge marks on the face ring
        a = k * math.tau / 48
        fx = Vector((math.cos(rot[2]), math.sin(rot[2]), 0))
        p = Vector((2.9, 0.2, 0.95)) + fx * (0.7 * math.cos(a)) + Vector((0, 0, 0.7 * math.sin(a))) + nrm * 0.06
        cube(tuple(p), (0.02, 0.02, 0.07), face, bevel=0.0, rot=(math.radians(90), a, rot[2]))
    for k in range(5):  # a small stack beside it
        cyl((1.6, -0.5, 0.03 + k * 0.06), 0.42, 0.055, g, verts=96, bevel=0.01)
    # a hardware wallet: rounded slab with a lit screen
    cube((4.15, -0.5, 0.07), (0.5, 0.9, 0.12), mat("Wallet", "#1A1F2E", metal=0.2, rough=0.35), bevel=0.05, rot=(0, 0, math.radians(15)))
    cube((4.15, -0.5, 0.135), (0.3, 0.45, 0.005), mat("Screen", "#000000", emit="#F07FB1", strength=3), bevel=0.0, rot=(0, 0, math.radians(15)))
    studio(CLASS["crypto"], (2.8, 0, 0.8))
    camera((2.85, 0, 0.9), subject_h=2.1, elev=0.1)
    render("crypto")


def scene_prediction():
    reset()
    floor()
    b = brass()
    c = (2.9, 0, 1.4)
    for k, (rx, rz) in enumerate(((90, 0), (0, 0), (90, 60), (90, -60))):
        torus(c, 0.85 - k * 0.05, 0.03, b, rot=(math.radians(rx), math.radians(25), math.radians(rz)))
    torus(c, 0.9, 0.04, b, rot=(math.radians(66), 0, 0))
    sphere(c, 0.22, mat("Core", "#6FD6C4", emit="#6FD6C4", strength=5, rough=0.2))
    cyl((2.9, 0, 0.5), 0.04, 0.95, b, verts=24)
    cyl((2.9, 0, 0.06), 0.5, 0.12, mat("Base", "#151A2B", metal=0.4, rough=0.3), verts=64, bevel=0.02)
    studio(CLASS["prediction"], (2.9, 0, 1.2))
    camera((2.9, 0, 1.2), subject_h=2.6, elev=0.06)
    render("prediction")


SCENES = dict(stocks=scene_stocks, ipo=scene_ipo, funds=scene_funds, fixed_income=scene_fixed_income, commodities=scene_commodities, global_=scene_global, crypto=scene_crypto, prediction=scene_prediction)
os.makedirs(args.out_dir, exist_ok=True)
for name, fn in SCENES.items():
    if args.only and args.only not in (name, name.rstrip("_")):
        continue
    fn()
