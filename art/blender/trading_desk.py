"""Market Survivor backdrop: a trading desk at night while the world outside changes (design.md §1).

Fully procedural — no external assets. One scene, four world-state moods:
  calm      deep indigo night, warm lamp, gently rising charts
  tension   amber haze over the city, choppy sideways charts
  crash     red glow outside, sirens on rooftops, charts falling off a cliff (also used for Halt)
  recovery  pre-dawn teal horizon, charts climbing out of a V

Usage (headless):
  Blender -b --factory-startup -P art/blender/trading_desk.py -- \
      --mood calm --frame wide --out apps/web/public/art/backdrop/desk-calm-wide.webp [--scale 0.5] [--samples 64]

Colour: 'Standard' view transform so token hexes render as the same hex (no AgX/Filmic wash-out).
The left ~45% of the wide frame and the top of the tall frame stay dark for UI text.
"""

import argparse
import math
import os
import random
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import realism  # noqa: E402  (shared Cycles + material detail pass)
from mathutils import Vector

# ---------------------------------------------------------------- args

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--mood", choices=["calm", "tension", "crash", "recovery"], default="calm")
ap.add_argument("--frame", choices=["wide", "tall"], default="wide")
ap.add_argument("--out", required=True)
ap.add_argument("--scale", type=float, default=1.0, help="resolution multiplier for quick previews")
ap.add_argument("--samples", type=int, default=64)
args = ap.parse_args(argv)


# ---------------------------------------------------------------- colour helpers

def srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_lin(h: str, a: float = 1.0):
    h = h.lstrip("#")
    return tuple(srgb_to_linear(int(h[i : i + 2], 16) / 255) for i in (0, 2, 4)) + (a,)


def hex_srgb(h: str):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))


# Design tokens (design.md §2)
INK_900, INK_800, INK_700, INK_600 = "#0F1424", "#161D33", "#1F2842", "#2C3757"
MARIGOLD, UP, DOWN, WARNING, CRITICAL = "#F2A93B", "#34C79A", "#F2645A", "#F28C38", "#FF4D4D"

MOODS = {
    "calm": dict(
        sky_top="#070A14", sky_mid="#0F1424", horizon="#26304F",
        city_lit=0.22, city_glow=4.0, city_warm="#F7C877",
        rim="#6F86D6", rim_energy=60, lamp=1.0, haze=0.006, haze_color="#2C3757",
        chart="up", accent=UP, beacons="#FF4D4D", beacon_strength=2.0,
    ),
    "tension": dict(
        sky_top="#0B0A12", sky_mid="#1E1620", horizon="#5A3420",
        city_lit=0.16, city_glow=3.2, city_warm="#F2A93B",
        rim=WARNING, rim_energy=42, lamp=0.85, haze=0.012, haze_color="#5A3420",
        chart="chop", accent=WARNING, beacons="#FF4D4D", beacon_strength=3.0,
    ),
    "crash": dict(
        sky_top="#0C070C", sky_mid="#1A1220", horizon="#5C1620",
        city_lit=0.09, city_glow=2.4, city_warm="#F7C877",
        rim=CRITICAL, rim_energy=60, lamp=0.65, haze=0.016, haze_color="#4D1A22",
        chart="crash", accent=DOWN, beacons="#FF2A2A", beacon_strength=14.0,
    ),
    "recovery": dict(
        sky_top="#0A0F1E", sky_mid="#14223A", horizon="#2F6B5C",
        city_lit=0.18, city_glow=3.0, city_warm="#F7C877",
        rim="#5CC8A8", rim_energy=36, lamp=0.9, haze=0.008, haze_color="#1D4A40",
        chart="recover", accent=UP, beacons="#FF4D4D", beacon_strength=2.0,
    ),
}
M = MOODS[args.mood]
RNG = random.Random(f"desk|{args.mood}")  # same city every render of a mood
CITY_RNG = random.Random("city")  # same skyline across moods

# ---------------------------------------------------------------- scene

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
ee = scene.eevee
ee.taa_render_samples = args.samples
for attr, val in (("use_raytracing", True), ("use_shadows", True), ("volumetric_tile_size", "4"), ("volumetric_end", 80.0)):
    if hasattr(ee, attr):
        try:
            setattr(ee, attr, val)
        except Exception:
            pass

scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.view_settings.exposure = 0.0
scene.view_settings.gamma = 1.0

if args.frame == "wide":
    W, H = 2400, 1350
else:
    W, H = 1080, 1440
scene.render.resolution_x = int(W * args.scale)
scene.render.resolution_y = int(H * args.scale)
scene.render.resolution_percentage = 100


# ---------------------------------------------------------------- material helpers

def material(name, base=INK_800, rough=0.6, metal=0.0, emit=None, emit_strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = hex_lin(base)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    if emit:
        p.inputs["Emission Color"].default_value = hex_lin(emit)
        p.inputs["Emission Strength"].default_value = emit_strength
    return m


def emission_material(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = hex_lin(color)
    e.inputs["Strength"].default_value = strength
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(e.outputs[0], out.inputs[0])
    return m


def box(name, loc, size, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = size
    o.data.materials.append(mat)
    return o


def cyl(name, loc, radius, depth, mat, rot=(0, 0, 0), verts=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return o


# ---------------------------------------------------------------- world: sky gradient + haze

world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
wn = world.node_tree
wn.nodes.clear()
tc = wn.nodes.new("ShaderNodeTexCoord")
sep = wn.nodes.new("ShaderNodeSeparateXYZ")
ramp = wn.nodes.new("ShaderNodeValToRGB")
bg = wn.nodes.new("ShaderNodeBackground")
wout = wn.nodes.new("ShaderNodeOutputWorld")
wn.links.new(tc.outputs["Generated"], sep.inputs[0])
mr = wn.nodes.new("ShaderNodeMapRange")
mr.inputs["From Min"].default_value = -0.05
mr.inputs["From Max"].default_value = 0.55
wn.links.new(sep.outputs["Z"], mr.inputs["Value"])
wn.links.new(mr.outputs["Result"], ramp.inputs["Fac"])
wn.links.new(ramp.outputs["Color"], bg.inputs["Color"])
wn.links.new(bg.outputs[0], wout.inputs["Surface"])
cr = ramp.color_ramp
cr.elements[0].position = 0.0
cr.elements[0].color = hex_lin(M["horizon"])
cr.elements[1].position = 1.0
cr.elements[1].color = hex_lin(M["sky_top"])
mid = cr.elements.new(0.25)
mid.color = hex_lin(M["sky_mid"])
bg.inputs["Strength"].default_value = 1.0


# ---------------------------------------------------------------- room

wall_mat = material("wall", "#121829", rough=0.85)
floor_mat = material("floor", "#0B0F1C", rough=0.32)
frame_mat = material("frame", "#0A0D18", rough=0.5, metal=0.3)

box("floor", (2, 1, -0.01), (16, 12, 0.02), floor_mat)
# Back wall at y = 4 with a wide window opening x ∈ [-0.6, 6.2], z ∈ [0.55, 3.4]
WX0, WX1, WZ0, WZ1, WY = -0.6, 6.2, 0.55, 3.4, 4.0
box("wall_low", ((WX0 + WX1) / 2, WY, WZ0 / 2), (WX1 - WX0, 0.2, WZ0), wall_mat)
box("wall_top", ((WX0 + WX1) / 2, WY, (WZ1 + 4.2) / 2), (WX1 - WX0, 0.2, 4.2 - WZ1), wall_mat)
box("wall_left", (WX0 - 4, WY, 2.1), (8, 0.2, 4.2), wall_mat)
box("wall_right", (WX1 + 4, WY, 2.1), (8, 0.2, 4.2), wall_mat)
box("wall_side", (-4.2, 0, 2.1), (0.2, 8, 4.2), wall_mat)  # keeps the left of frame dark
box("ceiling", (2, 1, 4.2), (16, 12, 0.1), wall_mat)
# Mullions
for x in (WX0, 1.65, 3.95, WX1):
    box(f"mullion_{x}", (x, WY - 0.05, (WZ0 + WZ1) / 2), (0.08, 0.12, WZ1 - WZ0), frame_mat)
for z in (WZ0, WZ1):
    box(f"transom_{z}", ((WX0 + WX1) / 2, WY - 0.05, z), (WX1 - WX0, 0.12, 0.08), frame_mat)
box("sill", ((WX0 + WX1) / 2, WY - 0.2, WZ0 + 0.02), (WX1 - WX0, 0.35, 0.04), frame_mat)

# ---------------------------------------------------------------- city (identical skyline across moods)


def city_material(lit_fraction, glow, warm):
    """Dark facades; a fraction of brick-grid 'windows' glow."""
    m = bpy.data.materials.new("city")
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = hex_lin("#0A0E1A")
    p.inputs["Roughness"].default_value = 0.9
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sxyz = nt.nodes.new("ShaderNodeSeparateXYZ")
    cxyz = nt.nodes.new("ShaderNodeCombineXYZ")
    xy = nt.nodes.new("ShaderNodeMath")
    xy.operation = "ADD"
    nt.links.new(geo.outputs["Position"], sxyz.inputs[0])
    nt.links.new(sxyz.outputs["X"], xy.inputs[0])
    nt.links.new(sxyz.outputs["Y"], xy.inputs[1])
    nt.links.new(xy.outputs[0], cxyz.inputs["X"])
    nt.links.new(sxyz.outputs["Z"], cxyz.inputs["Y"])
    brick = nt.nodes.new("ShaderNodeTexBrick")
    brick.offset = 0.0
    brick.inputs["Scale"].default_value = 1.0
    brick.inputs["Brick Width"].default_value = 1.5
    brick.inputs["Row Height"].default_value = 3.1
    brick.inputs["Mortar Size"].default_value = 0.6
    brick.inputs["Color1"].default_value = (1, 1, 1, 1)
    brick.inputs["Color2"].default_value = (1, 1, 1, 1)
    brick.inputs["Mortar"].default_value = (0, 0, 0, 1)
    nt.links.new(cxyz.outputs[0], brick.inputs["Vector"])
    # Which windows are lit: blocky noise sampled per brick cell.
    snap = nt.nodes.new("ShaderNodeVectorMath")
    snap.operation = "SNAP"
    snap.inputs[1].default_value = (1.5, 3.1, 1.0)
    nt.links.new(cxyz.outputs[0], snap.inputs[0])
    info = nt.nodes.new("ShaderNodeObjectInfo")
    add = nt.nodes.new("ShaderNodeVectorMath")
    add.operation = "ADD"
    nt.links.new(snap.outputs[0], add.inputs[0])
    nt.links.new(info.outputs["Random"], add.inputs[1])
    noise = nt.nodes.new("ShaderNodeTexWhiteNoise")
    noise.noise_dimensions = "3D"
    nt.links.new(add.outputs[0], noise.inputs["Vector"])
    thr = nt.nodes.new("ShaderNodeMath")
    thr.operation = "LESS_THAN"
    thr.inputs[1].default_value = lit_fraction
    nt.links.new(noise.outputs["Value"], thr.inputs[0])
    inv = nt.nodes.new("ShaderNodeMath")
    inv.operation = "SUBTRACT"
    inv.inputs[0].default_value = 1.0
    nt.links.new(brick.outputs["Fac"], inv.inputs[1])
    mask = nt.nodes.new("ShaderNodeMath")
    mask.operation = "MULTIPLY"
    nt.links.new(inv.outputs[0], mask.inputs[0])
    nt.links.new(thr.outputs[0], mask.inputs[1])
    # Some lit windows are cool white (screens), most warm.
    tint = nt.nodes.new("ShaderNodeMix")
    tint.data_type = "RGBA"
    tint.inputs["A"].default_value = hex_lin(warm)
    tint.inputs["B"].default_value = hex_lin("#BFD3FF")
    tint_noise = nt.nodes.new("ShaderNodeTexWhiteNoise")
    tint_noise.noise_dimensions = "3D"
    nt.links.new(add.outputs[0], tint_noise.inputs["Vector"])
    tint_thr = nt.nodes.new("ShaderNodeMath")
    tint_thr.operation = "GREATER_THAN"
    tint_thr.inputs[1].default_value = 0.08 / max(lit_fraction, 0.01) * 0.0 + 0.97
    nt.links.new(tint_noise.outputs["Color"], tint_thr.inputs[0])
    nt.links.new(tint_thr.outputs[0], tint.inputs["Factor"])
    strength = nt.nodes.new("ShaderNodeMath")
    strength.operation = "MULTIPLY"
    strength.inputs[1].default_value = glow
    nt.links.new(mask.outputs[0], strength.inputs[0])
    nt.links.new(tint.outputs["Result"], p.inputs["Emission Color"])
    nt.links.new(strength.outputs[0], p.inputs["Emission Strength"])
    return m


city_mat = city_material(M["city_lit"], M["city_glow"], M["city_warm"])
beacon_mat = emission_material("beacon", M["beacons"], M["beacon_strength"])
for row, (y0, scale) in enumerate(((55, 1.0), (95, 1.7), (160, 2.8))):
    x = -60.0 * scale
    while x < 90 * scale:
        w = CITY_RNG.uniform(6, 14) * scale
        d = CITY_RNG.uniform(6, 14) * scale
        tower = CITY_RNG.random() < 0.12
        # Rooftops hover around eye level (z≈1.4): we are on a high floor looking across the city.
        top = CITY_RNG.uniform(-10, 8) + (CITY_RNG.uniform(10, 24) if tower else 0) + row * 9
        base = -160.0
        h = top - base
        y = y0 + CITY_RNG.uniform(-3, 3) * scale
        b = box(f"bldg_{row}_{x:.0f}", (x + w / 2, y, base + h / 2), (w, d, h), city_mat)
        if CITY_RNG.random() < 0.18:
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5 * scale, location=(x + w / 2, y - d / 2, base + h + 0.4 * scale))
            bpy.context.object.data.materials.append(beacon_mat)
        x += w + CITY_RNG.uniform(1.5, 6.0) * scale

haze = bpy.data.materials.new("haze")
haze.use_nodes = True
hn = haze.node_tree
hn.nodes.clear()
htc = hn.nodes.new("ShaderNodeTexCoord")
hsep = hn.nodes.new("ShaderNodeSeparateXYZ")
hramp = hn.nodes.new("ShaderNodeValToRGB")
hramp.color_ramp.elements[0].position = 0.0
hramp.color_ramp.elements[0].color = (0.5, 0.5, 0.5, 1)
hramp.color_ramp.elements[1].position = 0.62
hramp.color_ramp.elements[1].color = (0, 0, 0, 1)
hemit = hn.nodes.new("ShaderNodeEmission")
hemit.inputs["Color"].default_value = hex_lin(M["haze_color"])
hemit.inputs["Strength"].default_value = 0.6 + 40 * M["haze"]
htr = hn.nodes.new("ShaderNodeBsdfTransparent")
hmix = hn.nodes.new("ShaderNodeMixShader")
hout = hn.nodes.new("ShaderNodeOutputMaterial")
hn.links.new(htc.outputs["Generated"], hsep.inputs[0])
hn.links.new(hsep.outputs["Y"], hramp.inputs["Fac"])
hn.links.new(hramp.outputs["Color"], hmix.inputs["Fac"])
hn.links.new(htr.outputs[0], hmix.inputs[1])
hn.links.new(hemit.outputs[0], hmix.inputs[2])
hn.links.new(hmix.outputs[0], hout.inputs[0])
if hasattr(haze, "surface_render_method"):
    haze.surface_render_method = "BLENDED"
for y_h in (75, 130):
    bpy.ops.mesh.primitive_plane_add(size=1, location=(15, y_h, -14), rotation=(math.radians(90), 0, 0))
    hp = bpy.context.object
    hp.scale = (420, 60, 1)
    hp.data.materials.append(haze)

# ---------------------------------------------------------------- chart textures for the monitors


def chart_series(kind, n, rng):
    v, out = 0.5, []
    for i in range(n):
        t = i / (n - 1)
        if kind == "up":
            v += 0.006 + rng.gauss(0, 0.012)
        elif kind == "chop":
            v += rng.gauss(0, 0.028) - (v - 0.5) * 0.08
        elif kind == "crash":
            v += (0.004 if t < 0.6 else -0.05 if t < 0.82 else -0.004) + rng.gauss(0, 0.014 if t < 0.6 else 0.03)
        else:  # recover: fall then V
            v += (-0.022 if t < 0.3 else 0.014) + rng.gauss(0, 0.016)
        out.append(v)
    lo, hi = min(out), max(out)
    return [0.12 + 0.76 * (x - lo) / (hi - lo or 1) for x in out]


class Canvas:
    def __init__(self, w, h, bg):
        self.w, self.h = w, h
        r, g, b = hex_srgb(bg)
        self.px = [r, g, b, 1.0] * (w * h)

    def blend(self, x, y, rgb, a):
        if 0 <= x < self.w and 0 <= y < self.h:
            i = (y * self.w + x) * 4
            p = self.px
            p[i] += (rgb[0] - p[i]) * a
            p[i + 1] += (rgb[1] - p[i + 1]) * a
            p[i + 2] += (rgb[2] - p[i + 2]) * a

    def rect(self, x0, y0, x1, y1, rgb, a=1.0):
        for y in range(max(0, int(y0)), min(self.h, int(y1))):
            for x in range(max(0, int(x0)), min(self.w, int(x1))):
                self.blend(x, y, rgb, a)

    def line(self, pts, rgb, width=2.0):
        r = width / 2
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
            for s in range(steps + 1):
                cx, cy = x0 + (x1 - x0) * s / steps, y0 + (y1 - y0) * s / steps
                for yy in range(int(cy - r - 1), int(cy + r + 2)):
                    for xx in range(int(cx - r - 1), int(cx + r + 2)):
                        dist = math.hypot(xx - cx, yy - cy)
                        if dist <= r + 0.5:
                            self.blend(xx, yy, rgb, min(1.0, r + 0.5 - dist))

    def to_image(self, name):
        img = bpy.data.images.new(name, self.w, self.h, alpha=False)
        img.pixels.foreach_set(self.px)
        img.pack()
        return img


def grid(c, rgb, cols=8, rows=5):
    for i in range(1, cols):
        c.rect(c.w * i / cols, 0, c.w * i / cols + 1, c.h, rgb, 0.5)
    for j in range(1, rows):
        c.rect(0, c.h * j / rows, c.w, c.h * j / rows + 1, rgb, 0.5)


SW, SH = 480, 280
SCREEN_BG = "#0B1120"
grid_rgb = hex_srgb(INK_600)
accent = hex_srgb(M["accent"])
up_rgb, down_rgb = hex_srgb(UP), hex_srgb(DOWN)


def screen_line():
    c = Canvas(SW, SH, SCREEN_BG)
    grid(c, grid_rgb)
    s = chart_series(M["chart"], 90, RNG)
    pts = [(12 + i * (SW - 24) / 89, SH * v) for i, v in enumerate(s)]
    # soft area fill under the line
    for i, (x, y) in enumerate(pts):
        c.rect(x, 0, x + (SW - 24) / 89 + 1, y, accent, 0.10)
    c.line(pts, accent, 3.0)
    c.rect(12, SH - 26, 120, SH - 16, hex_srgb("#98A1BC"), 0.6)  # title bar stub
    return c.to_image("scr_line")


def screen_candles():
    c = Canvas(SW, SH, SCREEN_BG)
    grid(c, grid_rgb)
    s = chart_series(M["chart"], 34, RNG)
    cw = (SW - 24) / 34
    prev = s[0]
    for i, v in enumerate(s):
        x = 12 + i * cw
        o, cl = prev, v
        hi, lo = max(o, cl) + RNG.uniform(0.01, 0.04), min(o, cl) - RNG.uniform(0.01, 0.04)
        col = up_rgb if cl >= o else down_rgb
        c.rect(x + cw * 0.45, SH * lo * 0.8 + 40, x + cw * 0.55, SH * hi * 0.8 + 40, col, 0.9)
        c.rect(x + cw * 0.18, SH * min(o, cl) * 0.8 + 40, x + cw * 0.82, SH * max(o, cl) * 0.8 + 41.5, col, 1.0)
        vol = RNG.uniform(0.2, 1.0) * (1.8 if M["chart"] == "crash" and i > 20 else 1.0)
        c.rect(x + cw * 0.18, 4, x + cw * 0.82, 4 + 28 * min(vol, 1.3), col, 0.45)
        prev = v
    return c.to_image("scr_candles")


def screen_heatmap():
    c = Canvas(SW, SH, SCREEN_BG)
    bias = {"up": 0.7, "chop": 0.45, "crash": 0.08, "recover": 0.62}[M["chart"]]
    x = 6
    while x < SW - 6:
        w = RNG.choice((60, 76, 92, 110))
        y = 6
        while y < SH - 6:
            h = RNG.choice((52, 64, 80))
            up = RNG.random() < bias
            strength = RNG.uniform(0.35, 1.0)
            base = hex_srgb(up and "#1D4A40" or "#4D2330")
            tone = up_rgb if up else down_rgb
            c.rect(x, y, min(x + w - 4, SW - 6), min(y + h - 4, SH - 6), base, 1.0)
            c.rect(x, y, min(x + w - 4, SW - 6), min(y + h - 4, SH - 6), tone, 0.35 * strength)
            y += h
        x += w
    return c.to_image("scr_heat")


def screen_material(name, img, strength=2.2):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = img
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Strength"].default_value = strength
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(t.outputs["Color"], e.inputs["Color"])
    nt.links.new(e.outputs[0], out.inputs[0])
    return m


# ---------------------------------------------------------------- desk + props

desk_mat = material("desk", "#1A1410", rough=0.45)  # dark walnut
metal_mat = material("metal", "#20263A", rough=0.35, metal=0.8)
bezel_mat = material("bezel", "#07090F", rough=0.4)
key_mat = material("keys", "#151A2A", rough=0.6)
mug_mat = material("mug", "#C9CCD6", rough=0.3)
shade_mat = material("shade", "#1B2236", rough=0.4, metal=0.6)

DX, DY, DZ = 2.6, 1.55, 0.76  # desk centre
box("desk_top", (DX, DY, DZ), (3.0, 1.0, 0.05), desk_mat)
for sx in (-1.4, 1.4):
    box(f"leg_{sx}", (DX + sx, DY, DZ / 2), (0.05, 0.9, DZ), metal_mat)

screens = [
    (screen_line(), -0.78, math.radians(22)),
    (screen_candles(), 0.0, 0.0),
    (screen_heatmap(), 0.78, math.radians(-22)),
]
MW, MH = 0.74, 0.43
for i, (img, off, rot) in enumerate(screens):
    cx = DX + off * 1.02
    cy = DY + 0.22 + abs(off) * -0.18
    cz = DZ + 0.42
    stand = box(f"stand_{i}", (cx, cy + 0.06, DZ + 0.16), (0.04, 0.04, 0.3), metal_mat)
    foot = box(f"foot_{i}", (cx, cy + 0.04, DZ + 0.03), (0.22, 0.16, 0.012), metal_mat)
    bez = box(f"bezel_{i}", (cx, cy, cz), (MW + 0.03, 0.025, MH + 0.03), bezel_mat, rot=(0, 0, rot))
    bpy.ops.mesh.primitive_plane_add(size=1, location=(cx, cy, cz), rotation=(math.radians(90), 0, rot))
    scr = bpy.context.object
    scr.scale = (MW, MH, 1)
    # nudge toward camera along the screen normal
    n = Vector((math.sin(rot), -math.cos(rot), 0))
    scr.location += n * 0.014
    scr.data.materials.append(screen_material(f"screen_{i}", img))
    # screens light the desk
    bpy.ops.object.light_add(type="AREA", location=scr.location + n * 0.25, rotation=(math.radians(90), 0, rot))
    L = bpy.context.object.data
    L.shape, L.size, L.size_y = "RECTANGLE", MW, MH
    L.color = tuple(0.55 + 0.45 * c for c in hex_lin(M["accent"])[:3])
    L.energy = 9

box("keyboard", (DX - 0.1, DY - 0.28, DZ + 0.035), (0.46, 0.15, 0.018), key_mat)
box("mouse", (DX + 0.32, DY - 0.28, DZ + 0.035), (0.06, 0.1, 0.02), key_mat)
cyl("mug", (DX + 0.95, DY - 0.22, DZ + 0.075), 0.045, 0.11, mug_mat)
# notebook
box("notebook", (DX - 0.9, DY - 0.2, DZ + 0.03), (0.3, 0.22, 0.012), material("paper", "#D8D4C8", rough=0.9), rot=(0, 0, 0.18))

# Desk lamp (marigold) at the right end of the desk
LX, LY = DX + 1.42, DY - 0.12
cyl("lamp_base", (LX, LY, DZ + 0.035), 0.09, 0.025, metal_mat)
arm1 = cyl("lamp_arm1", (LX - 0.05, LY, DZ + 0.28), 0.012, 0.5, metal_mat, rot=(0, math.radians(-12), 0))
arm2 = cyl("lamp_arm2", (LX - 0.12, LY - 0.05, DZ + 0.6), 0.012, 0.26, metal_mat, rot=(0, math.radians(-60), 0))
bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=0.12, radius2=0.035, depth=0.18, location=(LX - 0.22, LY - 0.08, DZ + 0.58), rotation=(0, math.radians(-150), 0))
shade = bpy.context.object
shade.data.materials.append(shade_mat)
bpy.ops.object.shade_smooth()
bulb = bpy.ops.mesh.primitive_uv_sphere_add(radius=0.03, location=(LX - 0.25, LY - 0.08, DZ + 0.53))
bpy.context.object.data.materials.append(emission_material("bulb", "#FFE2A8", 30 * M["lamp"]))
bpy.ops.object.light_add(type="SPOT", location=(LX - 0.26, LY - 0.08, DZ + 0.52))
spot = bpy.context.object
spot.rotation_euler = (math.radians(-2), math.radians(-12), 0)
spot.data.energy = 420 * M["lamp"]
spot.data.color = hex_lin(MARIGOLD)[:3]
spot.data.spot_size = math.radians(62)
spot.data.spot_blend = 0.6
spot.data.shadow_soft_size = 0.05
# warm bounce so the lamp pool reads on the desk
bpy.ops.object.light_add(type="POINT", location=(LX - 0.6, LY - 0.3, DZ + 0.25))
bpy.context.object.data.energy = 22 * M["lamp"]
bpy.context.object.data.shadow_soft_size = 0.4
if hasattr(bpy.context.object.data, "use_custom_distance"):
    bpy.context.object.data.use_custom_distance = True
    bpy.context.object.data.cutoff_distance = 0.9  # warm the desk, not the floor
bpy.context.object.data.color = hex_lin(MARIGOLD)[:3]

# ---------------------------------------------------------------- mood light through the window

bpy.ops.object.light_add(type="AREA", location=(2.8, WY + 0.6, 2.2))
rim = bpy.context.object
rim.rotation_euler = (math.radians(-90), 0, 0)
rim.data.shape, rim.data.size, rim.data.size_y = "RECTANGLE", WX1 - WX0, WZ1 - WZ0
rim.data.color = hex_lin(M["rim"])[:3]
rim.data.energy = M["rim_energy"]

if args.mood == "crash":
    # emergency-light wash sweeping in from the street below
    bpy.ops.object.light_add(type="SPOT", location=(5.5, WY + 2, -1.5))
    s2 = bpy.context.object
    s2.data.color = hex_lin(CRITICAL)[:3]
    s2.data.energy = 500
    s2.data.spot_size = math.radians(40)
    s2.rotation_euler = (math.radians(-60), math.radians(-12), math.radians(10))
if args.mood == "recovery":
    bpy.ops.object.light_add(type="SUN", location=(0, 30, 4))
    sun = bpy.context.object
    sun.data.color = hex_lin("#9FE3C8")[:3]
    sun.data.energy = 0.6
    sun.rotation_euler = (math.radians(-95), 0, math.radians(-15))

# ---------------------------------------------------------------- camera


def aim(cam, target):
    d = Vector(target) - cam.location
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


bpy.ops.object.camera_add()
cam = bpy.context.object
scene.camera = cam
if args.frame == "wide":
    cam.location = (0.15, -1.75, 1.42)
    cam.data.lens = 26
    aim(cam, (1.55, 1.6, 1.22))  # desk lands in the right half; left stays dark for text
else:
    # Phone: desk in the lower third, city and sky above for headings.
    cam.location = (1.75, -1.35, 1.12)
    cam.data.lens = 22
    aim(cam, (2.6, 2.4, 1.62))
cam.data.dof.use_dof = True
cam.data.dof.focus_distance = (Vector((DX, DY, DZ + 0.4)) - cam.location).length
cam.data.dof.aperture_fstop = 2.8

# ---------------------------------------------------------------- compositor: soft glow on screens/lamp (best effort across API versions)

try:
    tree = None
    if hasattr(scene, "compositing_node_group"):
        tree = bpy.data.node_groups.new("Comp", "CompositorNodeTree")
        scene.compositing_node_group = tree
        rl = tree.nodes.new("CompositorNodeRLayers")
        glare = tree.nodes.new("CompositorNodeGlare")
        out = tree.nodes.new("NodeGroupOutput")
        tree.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    else:
        scene.use_nodes = True
        tree = scene.node_tree
        tree.nodes.clear()
        rl = tree.nodes.new("CompositorNodeRLayers")
        glare = tree.nodes.new("CompositorNodeGlare")
        out = tree.nodes.new("CompositorNodeComposite")
    for name, val in (("Type", "Bloom"), ("Quality", "High"), ("Threshold", 0.85), ("Strength", 0.35), ("Size", 0.6)):
        if name in glare.inputs:
            try:
                glare.inputs[name].default_value = val
            except Exception:
                pass
    if hasattr(glare, "glare_type"):
        glare.glare_type = "BLOOM"
    tree.links.new(rl.outputs["Image"], glare.inputs["Image"])
    tree.links.new(glare.outputs["Image"], out.inputs[0])
except Exception as e:  # never fail a render over bloom
    print("COMPOSITOR_SKIPPED", e)

# ---------------------------------------------------------------- render

fmt = "WEBP" if args.out.lower().endswith(".webp") else "PNG"
scene.render.image_settings.file_format = fmt
if fmt == "WEBP":
    scene.render.image_settings.quality = 82
scene.render.image_settings.color_mode = "RGB"
scene.render.filepath = args.out
realism.finish(scene, max(args.samples, 128))
bpy.ops.render.render(write_still=True)
print("RENDERED", args.mood, args.frame, args.out)
