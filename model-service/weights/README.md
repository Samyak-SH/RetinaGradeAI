# Model weights

Drop the trained checkpoints here. They are gitignored because of their size.

| File | Lesion class | Required |
| --- | --- | --- |
| `MA_timm-efficientnet-b5_best.pt` | Microaneurysms | yes |
| `HE_timm-efficientnet-b5_best.pt` | Hemorrhages (split into dot/blot) | yes |
| `EX_timm-efficientnet-b5_best.pt` | Hard exudates | yes |
| `SE_timm-efficientnet-b5_best.pt` | Soft exudates | yes |
| `MA_native_timm-efficientnet-b5.pt` | Microaneurysms, native-resolution tiled path | optional |

If `MA_native_...pt` is present the service uses the tiled native-resolution path
for microaneurysms, matching `infer_image.py`. On CPU that path is considerably
slower; set `USE_MA_NATIVE=0` to force the whole-image path instead.

The directory is mounted read-only into the container at `/app/weights`.
