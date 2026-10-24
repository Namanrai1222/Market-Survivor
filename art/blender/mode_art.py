"""Market Survivor mode-card art: one object per mode, same palette and lighting as the desk icons.

  story        an open book with three rising candles standing on its pages
  freeplay     a block of Market City towers on a plinth (green and red roofs)
  daily        a tear-off calendar page with binder rings and a marigold "15"
  timemachine  an hourglass with gold sand
  academy      a graduation cap on a stack of books

Usage (headless, renders all five unless --only is given):
  Blender -b --factory-startup -P art/blender/mode_art.py -- --out-dir apps/web/public/art/modes [--only daily]
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
ap.add_argument("--out-dir", required=True)
ap.add_argument("--width", type=int, default=720)
ap.add_argument("--height", type=int, default=480)
ap.add_argument("--samples", type=int, default=64)
ap.add_argument("--only", default="")
args = ap.parse_args(argv)


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_lin(h, a=1.0):
    h = h.lstrip("#")
    return tuple(srgb_to_linear(int(h[i : i + 2], 16) / 255) for i in (0, 2, 4)) + (a,)


C = dict(
    marigold="#F2A93B", stocks="#7C8CF8", funds="#5CC8E6", fixed="#9AD18B", gold="#E3B341", global_="#C58AF0",
    crypto="#F07FB1", prediction="#6FD6C4", ink900="#0F1424", ink700="#1F2842", ink600="#2C3757", up="#34C79A",
    down="#F2645A", paper="#E9E4D6", leather="#3A2E5C",
)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.eevee.taa_render_samples = args.samples
if hasattr(scene.eevee, "use_raytracing"):
    scene.eevee.use_raytracing = True
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.render.film_transparent = True
scene.render.resolution_x, scene.render.resolution_y = args.width, args.height
scene.render.image_settings.file_format = "WEBP"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.quality = 88

world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = hex_lin("#2A3354")
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8


def light(kind, loc, energy, color="#FFFFFF", size=2.0):
    bpy.ops.object.light_add(type=kind, location=loc)
    o = bpy.context.object
    o.data.energy = energy
    o.data.color = hex_lin(color)[:3]
    if kind == "AREA":
        o.data.size = size
    o.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    o["keep"] = True


light("AREA", (-2.5, -3.0, 4.0), 480, "#FFF4E2", 3.0)
light("AREA", (3.5, -1.0, 1.0), 120, "#9FB2FF", 3.0)
light("AREA", (0.5, 3.5, 2.5), 500, "#FFFFFF", 2.0)

bpy.ops.object.camera_add(location=(4.6, -4.6, 3.4))
cam = bpy.context.object
cam["keep"] = True
cam.data.type = "ORTHO"
cam.rotation_euler = (Vector((0, 0, 0.1)) - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

_mats = {}


def mat(color, metal=0.0, rough=0.45, emit=0.12, alpha=1.0, transmission=0.0):
    key = (color, metal, rough, emit, alpha, transmission)
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(color)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = hex_lin(color)
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rough
    p.inputs["Emission Color"].default_value = hex_lin(color)
    p.inputs["Emission Strength"].default_value = emit
    if alpha < 1:
        p.inputs["Alpha"].default_value = alpha
        if hasattr(m, "surface_render_method"):
            m.surface_render_method = "BLENDED"
    if transmission:
        p.inputs["Transmission Weight"].default_value = transmission
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


def cone(loc, r1, r2, depth, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=64, radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rot)
    return finish(bpy.context.object, m, 0.01, smooth=True)


def torus(loc, R, r, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc, rotation=rot, major_segments=48, minor_segments=12)
    return finish(bpy.context.object, m, 0, smooth=True)


def text(body, loc, size, m, rot=(math.radians(90), 0, 0), extrude=0.04):
    bpy.ops.object.text_add(location=loc, rotation=rot)
    o = bpy.context.object
    o.data.body = body
    o.data.size = size
    o.data.extrude = extrude
    o.data.align_x = "CENTER"
    o.data.align_y = "CENTER"
    o.data.materials.append(m)
    return o


def candle(x, y, z, h, m, w=0.16):
    box((x, y, z + h / 2), (w, w, h), m, bevel=0.025)
    cyl((x, y, z + h + 0.09), 0.018, 0.18, m, verts=12, bevel=0)
    cyl((x, y, z - 0.03), 0.018, 0.06, m, verts=12, bevel=0)


def fit_camera(margin=0.08):
    dg = bpy.context.evaluated_depsgraph_get()
    inv = cam.matrix_world.inverted()
    xs, ys = [], []
    for o in bpy.data.objects:
        if o.type not in ("MESH", "FONT"):
            continue
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        for v in me.vertices:
            p = inv @ (ev.matrix_world @ v.co)
            xs.append(p.x)
            ys.append(p.y)
        ev.to_mesh_clear()
    aspect = args.width / args.height
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    scale = max(w, h * aspect) * (1 + 2 * margin)
    cam.data.ortho_scale = scale
    cam.data.shift_x = ((max(xs) + min(xs)) / 2) / scale
    cam.data.shift_y = ((max(ys) + min(ys)) / 2) / scale


def clear():
    for o in list(bpy.data.objects):
        if not o.get("keep"):
            bpy.data.objects.remove(o, do_unlink=True)


# ---------------------------------------------------------------- art


def art_story():
    cover, paper, ribbon = mat(C["leather"], rough=0.6, emit=0.0), mat(C["paper"], rough=0.8, emit=0.05), mat(C["marigold"], emit=0.2)
    box((0, 0, -0.06), (2.6, 1.7, 0.06), cover, bevel=0.03)
    for side in (-1, 1):  # two pages, tilted up from the spine
        box((side * 0.64, 0, 0.06), (1.22, 1.6, 0.12), paper, rot=(0, math.radians(-6 * side), 0), bevel=0.03)
    box((0.08, -0.82, 0.02), (0.12, 0.04, 0.5), ribbon, rot=(math.radians(12), 0, 0), bevel=0)
    up, down = mat(C["up"], emit=0.25), mat(C["down"], emit=0.25)
    candle(0.35, -0.1, 0.13, 0.32, up)
    candle(0.65, 0.05, 0.13, 0.48, down)
    candle(0.95, 0.2, 0.13, 0.7, up)
    for i, ly in enumerate((-0.45, -0.25, -0.05, 0.15, 0.35)):  # text lines on the left page
        box((-0.66, ly, 0.13 + 0.004 * i), (0.85 - 0.12 * (i % 2), 0.035, 0.008), mat("#B9B3A3", emit=0), bevel=0)


def art_freeplay():
    plinth, edge = mat(C["ink700"], rough=0.5, emit=0.0), mat(C["marigold"], metal=0.3, rough=0.3)
    box((0, 0, -0.1), (2.6, 2.0, 0.2), plinth, bevel=0.05)
    box((0, -1.0, -0.1), (2.6, 0.02, 0.21), edge, bevel=0)
    body = mat("#1A2240", rough=0.6, emit=0.0)
    win = mat("#F7C877", emit=1.2, rough=0.3)
    towers = [(-0.8, -0.5, 1.1, "up"), (-0.2, -0.55, 1.7, "up"), (0.45, -0.45, 0.9, "down"), (0.95, -0.5, 1.35, "up"),
              (-0.75, 0.35, 0.8, "down"), (-0.1, 0.4, 1.3, "up"), (0.6, 0.45, 1.9, "up")]
    for x, y, h, d in towers:
        box((x, y, h / 2), (0.42, 0.42, h), body, bevel=0.02)
        box((x, y, h + 0.03), (0.44, 0.44, 0.06), mat(C["up"] if d == "up" else C["down"], emit=0.9), bevel=0.01)
        for k in range(int(h / 0.22)):  # a column of lit windows on the camera-facing side
            if (k + int(x * 10)) % 3 != 0:
                box((x - 0.1, y - 0.215, 0.18 + k * 0.22), (0.08, 0.01, 0.1), win, bevel=0)
                box((x + 0.1, y - 0.215, 0.18 + k * 0.22), (0.08, 0.01, 0.1), win, bevel=0)


def art_daily():
    page, back, ring = mat("#F4F1E8", rough=0.8, emit=0.05), mat(C["stocks"], rough=0.5), mat("#C9CCD6", metal=0.8, rough=0.25)
    box((0, 0.06, 0), (1.9, 0.12, 2.1), back, bevel=0.05)
    box((0, -0.02, -0.1), (1.75, 0.06, 1.75), page, bevel=0.03)
    box((0, -0.03, 0.88), (1.75, 0.07, 0.36), mat(C["down"], emit=0.25), bevel=0.03)
    for x in (-0.5, 0, 0.5):
        torus((x, 0.02, 1.08), 0.14, 0.03, ring, rot=(0, math.radians(90), 0))
    t = text("15", (0, -0.07, -0.2), 1.05, mat(C["marigold"], emit=0.35), extrude=0.05)
    t.data.body = "15"
    # a small green arrow ticking up in the corner
    candle(0.62, -0.08, -0.85, 0.25, mat(C["up"], emit=0.3), w=0.1)
    candle(0.42, -0.08, -0.85, 0.15, mat(C["up"], emit=0.3), w=0.1)


def art_timemachine():
    frame, glass, sand = mat(C["leather"], rough=0.5), mat("#CFE3FF", rough=0.05, emit=0.05, alpha=0.28), mat(C["gold"], metal=0.6, rough=0.35, emit=0.15)
    cyl((0, 0, -1.05), 0.9, 0.14, frame, verts=64, bevel=0.03)
    cyl((0, 0, 1.05), 0.9, 0.14, frame, verts=64, bevel=0.03)
    for a in (0, 120, 240):
        r = math.radians(a)
        cyl((0.78 * math.cos(r), 0.78 * math.sin(r), 0), 0.05, 2.0, mat(C["marigold"], metal=0.6, rough=0.3), verts=24)
    cone((0, 0, 0.5), 0.12, 0.62, 0.95, glass)
    cone((0, 0, -0.5), 0.62, 0.12, 0.95, glass)
    cone((0, 0, -0.78), 0.56, 0.14, 0.38, sand, rot=(0, 0, 0))
    cone((0, 0, 0.32), 0.05, 0.3, 0.3, sand)
    cyl((0, 0, -0.2), 0.02, 0.5, sand, verts=12, bevel=0)


def art_academy():
    books = [(C["stocks"], 0.0, 0.0), (C["funds"], -0.06, 0.32), (C["fixed"], 0.05, 0.62)]
    for col, dx, z in books:
        box((dx, 0, z - 0.6), (1.8, 1.25, 0.3), mat(col, rough=0.5), rot=(0, 0, math.radians(dx * 60)), bevel=0.04)
        box((dx + 0.05, 0, z - 0.6), (1.72, 1.17, 0.24), mat(C["paper"], rough=0.8, emit=0.03), rot=(0, 0, math.radians(dx * 60)), bevel=0.02)
    cap, gold = mat("#1B2236", rough=0.45), mat(C["marigold"], metal=0.4, rough=0.3, emit=0.2)
    cyl((0, 0, 0.35), 0.5, 0.36, cap, verts=48)
    box((0, 0, 0.56), (1.45, 1.45, 0.06), cap, rot=(0, 0, math.radians(45)), bevel=0.02)
    cyl((0, 0, 0.6), 0.08, 0.05, gold, verts=24)
    box((0.48, -0.48, 0.58), (0.04, 0.7, 0.03), gold, rot=(0, 0, math.radians(45)), bevel=0)
    cyl((0.75, -0.75, 0.32), 0.035, 0.5, gold, verts=12, bevel=0)
    cone((0.75, -0.75, 0.0), 0.11, 0.03, 0.22, gold)


ART = dict(story=art_story, freeplay=art_freeplay, daily=art_daily, timemachine=art_timemachine, academy=art_academy)

os.makedirs(args.out_dir, exist_ok=True)
only = {s.strip() for s in args.only.split(",") if s.strip()}
for name, build in ART.items():
    if only and name not in only:
        continue
    clear()
    build()
    fit_camera()
    scene.render.filepath = os.path.join(args.out_dir, f"{name}.webp")
    realism.finish(scene, max(args.samples, 96))
    bpy.ops.render.render(write_still=True)
    print("RENDERED", name)
