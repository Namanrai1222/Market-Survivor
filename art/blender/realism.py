"""Shared "photographic" render pass for the Market Survivor Blender scripts.

  setup(scene)   Cycles path tracing on the Metal GPU (CPU fallback), adaptive sampling + denoising,
                 Khronos PBR Neutral view transform (photographic, but keeps brand colours true).
  detail()       Adds micro-detail to every Principled material that doesn't already have it: roughness
                 that varies across the surface (smudges, polish wear) and a fine bump (casting grain,
                 paper fibre, brushed metal). Glass and strong emitters are left clean.

Scripts opt in with:  sys.path.insert(0, os.path.dirname(__file__)); import realism
"""

import bpy


def setup(scene, samples=128):
    scene.render.engine = "CYCLES"
    c = scene.cycles
    c.samples = samples
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.02
    c.use_denoising = True
    c.max_bounces = 8
    c.caustics_reflective = False
    c.caustics_refractive = False
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        c.device = "GPU"
    except Exception:
        c.device = "CPU"
    scene.view_settings.view_transform = "Khronos PBR Neutral"
    scene.view_settings.look = "None"


def _linked(sock):
    return bool(sock.is_linked)


def detail(bump=0.015, scale=1.0):
    """Roughness variation + micro bump on every Principled material (idempotent)."""
    for m in bpy.data.materials:
        if not m.use_nodes or m.get("realism"):
            continue
        nt = m.node_tree
        bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if bsdf is None:
            continue
        m["realism"] = True
        glass = bsdf.inputs["Transmission Weight"].default_value > 0.5 or bsdf.inputs["Alpha"].default_value < 0.5
        emissive = bsdf.inputs["Emission Strength"].default_value > 1.0
        coord = nt.nodes.new("ShaderNodeTexCoord")

        if not _linked(bsdf.inputs["Roughness"]):
            r = bsdf.inputs["Roughness"].default_value
            n1 = nt.nodes.new("ShaderNodeTexNoise")
            n1.inputs["Scale"].default_value = 14.0 * scale
            n1.inputs["Detail"].default_value = 6.0
            nt.links.new(coord.outputs["Object"], n1.inputs["Vector"])
            mr = nt.nodes.new("ShaderNodeMapRange")
            mr.inputs["From Min"].default_value = 0.3
            mr.inputs["From Max"].default_value = 0.7
            mr.inputs["To Min"].default_value = max(0.02, r * 0.85)
            mr.inputs["To Max"].default_value = min(1.0, r * 1.2 + 0.02)
            nt.links.new(n1.outputs["Fac"], mr.inputs["Value"])
            nt.links.new(mr.outputs["Result"], bsdf.inputs["Roughness"])

        if not glass and not emissive and not _linked(bsdf.inputs["Normal"]):
            n2 = nt.nodes.new("ShaderNodeTexNoise")
            n2.inputs["Scale"].default_value = 160.0 * scale
            n2.inputs["Detail"].default_value = 10.0
            n2.inputs["Roughness"].default_value = 0.6
            nt.links.new(coord.outputs["Object"], n2.inputs["Vector"])
            b = nt.nodes.new("ShaderNodeBump")
            b.inputs["Strength"].default_value = bump
            b.inputs["Distance"].default_value = 0.002
            nt.links.new(n2.outputs["Fac"], b.inputs["Height"])
            nt.links.new(b.outputs["Normal"], bsdf.inputs["Normal"])


def finish(scene, samples=128, bump=0.015):
    """Both steps, right before rendering."""
    setup(scene, samples)
    detail(bump)
