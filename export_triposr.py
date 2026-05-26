#!/usr/bin/env python3
"""
export_triposr.py  —  Export TripoSR to browser-ready ONNX files
════════════════════════════════════════════════════════════════════
Splits the TripoSR model into three independently runnable ONNX files
that together reproduce the full image → 3D mesh pipeline:

  encoder_q8.onnx   (~22 MB)  image(1,3,224,224) → tokens(1,N_tok,D)
  decoder_q8.onnx   (~75 MB)  tokens(1,N_tok,D)  → triplane(1,3C,H,W)
  nerf_mlp_q8.onnx  (~2  MB)  features(B,3C)     → density_rgb(B,4)
  shapes.json                  runtime constants for browser worker

Prerequisites (Python ≥ 3.10, GPU optional):
  pip install torch torchvision transformers huggingface_hub
  pip install onnx onnxruntime onnxsim
  git clone https://github.com/VAST-AI-Research/TripoSR
  cd TripoSR && pip install -e .

Run:
  python export_triposr.py --output ./triposr_onnx [--device cpu|cuda]

Then host the output directory and set ONNX_BASE_URL in extrapolation.html.
Local test: cd triposr_onnx && python -m http.server 8888
"""

import os, sys, json, argparse, inspect
from pathlib import Path
import torch
import torch.nn as nn
import numpy as np

# ── Helpers ───────────────────────────────────────────────────────────────────
def mb(path):
    return f"{os.path.getsize(path)/1024/1024:.1f}MB"

def onnx_simplify(path):
    """Graph simplification: constant folding + dead node removal."""
    try:
        import onnx, onnxsim
        model = onnx.load(path)
        simplified, ok = onnxsim.simplify(model)
        if ok:
            onnx.save(simplified, path)
            print(f"    simplified ✔")
        else:
            print(f"    simplify check failed — keeping original")
    except ImportError:
        print(f"    (pip install onnxsim for graph simplification)")

def onnx_quantize_int8(src, dst):
    """Dynamic INT8 weight quantization — ~4× smaller, ≤2% quality loss."""
    from onnxruntime.quantization import quantize_dynamic, QuantType
    quantize_dynamic(
        model_input=src,
        model_output=dst,
        weight_type=QuantType.QInt8,
        per_channel=False,       # per-channel can break WebGPU kernel selection
        reduce_range=False,
        optimize_model=True
    )
    ratio = os.path.getsize(src) / os.path.getsize(dst)
    print(f"    quantised → {mb(dst)}  ({ratio:.1f}× smaller)")

# ── Wrapper modules for clean ONNX export ─────────────────────────────────────
class EncoderExport(nn.Module):
    """
    Wraps TripoSR's image_tokenizer.
    Input:  (1, 3, 224, 224)  — ImageNet-normalised RGB
    Output: (1, N_tokens, D)  — patch + CLS tokens, typically (1, 197, 768)
    """
    def __init__(self, model):
        super().__init__()
        self.tokenizer = model.image_tokenizer

    def forward(self, image: torch.Tensor):
        return self.tokenizer(image)   # ViT forward pass


class DecoderExport(nn.Module):
    """
    Wraps TripoSR's backbone transformer + post_processor.
    The decoder uses learned output-query tokens (stored as buffer)
    and cross-attends to the image tokens from the encoder.

    Input:  image_tokens (1, N_img_tok, D_img)
    Output: triplane     (1, 3*C, H, W)  — three flattened feature planes
    """
    def __init__(self, model):
        super().__init__()
        self.backbone       = model.backbone
        self.post_processor = model.post_processor
        # The tokenizer holds the learnable output query embeddings.
        # We freeze and register them as a buffer so they're baked into ONNX.
        queries = model.tokenizer.weight.detach()  # (N_out_tok, D)
        self.register_buffer("output_queries", queries)

    def forward(self, image_tokens: torch.Tensor):
        B = image_tokens.shape[0]
        # Expand queries to batch dimension
        queries = self.output_queries.unsqueeze(0).expand(B, -1, -1)
        # Backbone: self-attention on queries, cross-attention to image tokens
        triplane_tokens = self.backbone(queries, image_tokens)
        # Post-process: reshape tokens → triplane spatial maps
        triplane = self.post_processor(triplane_tokens)
        return triplane    # (B, 3*C, H, W)


class NerfMLPExport(nn.Module):
    """
    Wraps TripoSR's NeRF decoder MLP.
    Input:  triplane_features (B, 3*C)  — concatenated bilinear samples
    Output: density_rgb       (B, 4)    — [density, r, g, b]
    """
    def __init__(self, model):
        super().__init__()
        # TripoSR's renderer holds the density/color MLP
        # Adjust attribute path if the model structure differs
        self.mlp = model.renderer.decoder

    def forward(self, features: torch.Tensor):
        return self.mlp(features)


# ── Main export logic ─────────────────────────────────────────────────────────
def load_triposr(device):
    """Clone TripoSR repo if needed and load model."""
    repo = Path("TripoSR")
    if not repo.exists():
        print("Cloning TripoSR repository...")
        os.system("git clone https://github.com/VAST-AI-Research/TripoSR")
    sys.path.insert(0, str(repo))

    try:
        from tsr.system import TSR
    except ImportError:
        print("ERROR: TripoSR not importable. Run: cd TripoSR && pip install -e .")
        sys.exit(1)

    print("Loading TripoSR weights from HuggingFace (~1.2GB, cached)...")
    model = TSR.from_pretrained(
        "stabilityai/TripoSR",
        config_name="config.yaml",
        weight_name="model.ckpt",
    )
    model = model.to(device).eval()
    print("  Model loaded ✔")
    return model


def probe_shapes(model, device):
    """
    Run one forward pass to discover the actual tensor shapes
    (they can vary slightly between TripoSR versions).
    """
    print("Probing tensor shapes...")
    dummy_img = torch.zeros(1, 3, 224, 224, device=device)
    with torch.no_grad():
        enc_wrapper = EncoderExport(model)
        tokens = enc_wrapper(dummy_img)
        N_tok, D_tok = tokens.shape[1], tokens.shape[2]
        print(f"  encoder output: (1, {N_tok}, {D_tok})")

        dec_wrapper = DecoderExport(model)
        triplane = dec_wrapper(tokens)
        # triplane is (1, 3*C, H, W) — determine C, H, W
        _, CHW, H, W = triplane.shape
        C = CHW // 3
        assert CHW == 3 * C, f"Unexpected triplane channels: {CHW}"
        print(f"  decoder output: (1, {CHW}, {H}, {W})  — C={C}")

        nerf_wrapper = NerfMLPExport(model)
        dummy_feat = torch.zeros(4, 3 * C, device=device)
        nerf_out = nerf_wrapper(dummy_feat)
        D_out = nerf_out.shape[1]
        print(f"  nerf_mlp output: (B, {D_out})")

    return {
        "N_tok": N_tok, "D_tok": D_tok,
        "triplane_channels": CHW, "C": C,
        "triplane_H": H, "triplane_W": W,
        "nerf_out_dim": D_out,
        "imagenet_mean": [0.485, 0.456, 0.406],
        "imagenet_std":  [0.229, 0.224, 0.225],
        "mc_threshold":  0.0,
    }


def export_encoder(model, shapes, out_dir, device):
    print("\n[1/3] Exporting encoder...")
    wrapper = EncoderExport(model).to(device).eval()
    dummy = torch.zeros(1, 3, 224, 224, device=device)
    fp32_path = str(out_dir / "encoder.onnx")

    with torch.no_grad():
        torch.onnx.export(
            wrapper, dummy, fp32_path,
            input_names=["image"],
            output_names=["tokens"],
            dynamic_axes={"image": {0: "batch"}, "tokens": {0: "batch"}},
            opset_version=17,
            do_constant_folding=True,
        )
    print(f"  encoder.onnx  {mb(fp32_path)}")
    onnx_simplify(fp32_path)

    q8_path = str(out_dir / "encoder_q8.onnx")
    onnx_quantize_int8(fp32_path, q8_path)
    return fp32_path, q8_path


def export_decoder(model, shapes, out_dir, device):
    print("\n[2/3] Exporting decoder (largest model — may take ~1 min)...")
    wrapper = DecoderExport(model).to(device).eval()
    N_tok, D_tok = shapes["N_tok"], shapes["D_tok"]
    dummy = torch.zeros(1, N_tok, D_tok, device=device)
    fp32_path = str(out_dir / "decoder.onnx")

    with torch.no_grad():
        torch.onnx.export(
            wrapper, dummy, fp32_path,
            input_names=["image_tokens"],
            output_names=["triplane"],
            dynamic_axes={
                "image_tokens": {0: "batch"},
                "triplane":     {0: "batch"},
            },
            opset_version=17,
            do_constant_folding=True,
        )
    print(f"  decoder.onnx  {mb(fp32_path)}")
    onnx_simplify(fp32_path)

    q8_path = str(out_dir / "decoder_q8.onnx")
    onnx_quantize_int8(fp32_path, q8_path)
    return fp32_path, q8_path


def export_nerf_mlp(model, shapes, out_dir, device):
    print("\n[3/3] Exporting NeRF MLP...")
    wrapper = NerfMLPExport(model).to(device).eval()
    C3 = shapes["triplane_channels"]   # 3*C features per point
    dummy = torch.zeros(4096, C3, device=device)
    fp32_path = str(out_dir / "nerf_mlp.onnx")

    with torch.no_grad():
        torch.onnx.export(
            wrapper, dummy, fp32_path,
            input_names=["triplane_features"],
            output_names=["density_rgb"],
            dynamic_axes={
                "triplane_features": {0: "n_points"},
                "density_rgb":       {0: "n_points"},
            },
            opset_version=17,
            do_constant_folding=True,
        )
    print(f"  nerf_mlp.onnx  {mb(fp32_path)}")
    onnx_simplify(fp32_path)

    q8_path = str(out_dir / "nerf_mlp_q8.onnx")
    onnx_quantize_int8(fp32_path, q8_path)
    return fp32_path, q8_path


def verify_pipeline(out_dir, shapes, device):
    """Quick sanity check: run all 3 exported models end-to-end."""
    print("\nVerifying exported pipeline...")
    import onnxruntime as ort
    opts = ort.SessionOptions()
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

    enc = ort.InferenceSession(str(out_dir / "encoder_q8.onnx"), opts)
    dec = ort.InferenceSession(str(out_dir / "decoder_q8.onnx"), opts)
    nerf = ort.InferenceSession(str(out_dir / "nerf_mlp_q8.onnx"), opts)

    img = np.random.rand(1, 3, 224, 224).astype(np.float32)
    tokens = enc.run(None, {"image": img})[0]
    triplane = dec.run(None, {"image_tokens": tokens})[0]
    C3 = shapes["triplane_channels"]
    feats = np.random.rand(16, C3).astype(np.float32)
    out = nerf.run(None, {"triplane_features": feats})[0]

    print(f"  tokens   shape: {tokens.shape}")
    print(f"  triplane shape: {triplane.shape}")
    print(f"  nerf out shape: {out.shape}")
    print("  Pipeline verified ✔")


def main():
    p = argparse.ArgumentParser(description="Export TripoSR to browser ONNX")
    p.add_argument("--output", default="./triposr_onnx")
    p.add_argument("--device", default="cpu", choices=["cpu", "cuda"])
    p.add_argument("--keep-fp32", action="store_true",
                   help="Keep full-precision ONNX files alongside quantised")
    args = p.parse_args()

    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)
    device = args.device

    model = load_triposr(device)
    shapes = probe_shapes(model, device)

    # Save shapes first — browser worker needs them even before ONNX files finish loading
    with open(out_dir / "shapes.json", "w") as f:
        json.dump(shapes, f, indent=2)
    print(f"\n  shapes.json saved ✔")

    fp32_paths = []
    fp32_paths.append(export_encoder(model, shapes, out_dir, device))
    fp32_paths.append(export_decoder(model, shapes, out_dir, device))
    fp32_paths.append(export_nerf_mlp(model, shapes, out_dir, device))

    verify_pipeline(out_dir, shapes, device)

    if not args.keep_fp32:
        for fp32, _ in fp32_paths:
            os.remove(fp32)
        print("\n  FP32 files removed (use --keep-fp32 to keep them)")

    total_q8 = sum(
        os.path.getsize(out_dir / f)
        for f in ["encoder_q8.onnx", "decoder_q8.onnx", "nerf_mlp_q8.onnx"]
    ) / 1024 / 1024

    print(f"""
╔══════════════════════════════════════════════════════════╗
║  EXPORT COMPLETE                                         ║
╠══════════════════════════════════════════════════════════╣
║  Output: {str(out_dir):<47} ║
║  Total browser download: {total_q8:.0f} MB (cached after first use) ║
╠══════════════════════════════════════════════════════════╣
║  NEXT STEPS                                              ║
║                                                          ║
║  Option A — HuggingFace Hub (recommended):               ║
║    pip install huggingface_hub                           ║
║    huggingface-cli login                                 ║
║    huggingface-cli upload YOUR_ORG/triposr-onnx \\        ║
║      {str(out_dir):<49} ║
║    Then in extrapolation.html set:                       ║
║      ONNX_BASE = 'https://huggingface.co/YOUR_ORG/...'  ║
║                                                          ║
║  Option B — local test server:                           ║
║    cd {str(out_dir):<50} ║
║    python -m http.server 8888                            ║
║    Then in extrapolation.html set:                       ║
║      ONNX_BASE = 'http://localhost:8888'                 ║
╚══════════════════════════════════════════════════════════╝
""")


if __name__ == "__main__":
    main()
