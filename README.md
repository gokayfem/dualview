<p align="center">
  <img src="public/favicon.svg" width="80" height="80" alt="DualView Logo">
</p>

<h1 align="center">DualView</h1>

<p align="center">
  <a href="https://dualview.ai">
    <img src="https://img.shields.io/badge/Website-dualview.ai-ff5722?style=for-the-badge" alt="Website">
  </a>
  <a href="https://github.com/gokayfem">
    <img src="https://img.shields.io/badge/GitHub-gokayfem-181717?style=for-the-badge&logo=github" alt="GitHub">
  </a>
  <a href="https://x.com/gokayfem">
    <img src="https://img.shields.io/badge/X-@gokayfem-000000?style=for-the-badge&logo=x" alt="X">
  </a>
  <a href="https://huggingface.co/gokaygokay">
    <img src="https://img.shields.io/badge/HuggingFace-gokaygokay-yellow?style=for-the-badge&logo=huggingface" alt="Hugging Face">
  </a>
</p>

<p align="center">
  <strong>The Ultimate Comparison Tool for Creative Professionals</strong>
</p>

<p align="center">
  Compare videos, images, audio, 3D models, documents, and text with professional-grade precision.<br>
  GPU-accelerated analysis • 100+ transitions • Frame-accurate sync • Real-time metrics
</p>

<br>

<p align="center">
  <img src="https://github.com/user-attachments/assets/24a2b466-a9d9-4b0a-990a-66b47b308357" alt="DualView Demo" width="100%">
</p>

<br>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#comparison-modes">Modes</a> •
  <a href="#webgl-analysis">Analysis</a> •
  <a href="#export">Export</a> •
  <a href="#shortcuts">Shortcuts</a> •
  <a href="#getting-started">Get Started</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.2.0-61DAFB?style=flat-square&logo=react" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.9.3-3178C6?style=flat-square&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-7.2.4-646CFF?style=flat-square&logo=vite" alt="Vite">
  <img src="https://img.shields.io/badge/Three.js-0.182-000000?style=flat-square&logo=threedotjs" alt="Three.js">
  <img src="https://img.shields.io/badge/WebGL-GPU_Accelerated-990000?style=flat-square&logo=webgl" alt="WebGL">
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License">
</p>

---

## Why DualView?

Whether you're a **VFX artist** comparing renders, an **AI researcher** evaluating model outputs, a **photographer** checking edits, or a **QA engineer** catching regressions — DualView gives you the tools to see differences that matter.

> **Drop your files** → **Choose a mode** → **Analyze** → **Export**

| Type | vs | Analysis |
|:-----|:--:|:---------|
| 🎬 **Video** | ↔ | SSIM similarity, pixel difference, heatmaps |
| 🖼️ **Image** | ↔ | Delta E color diff, histogram, false color |
| 🎵 **Audio** | ↔ | LUFS loudness, stereo width, phase correlation |
| 📦 **3D Model** | ↔ | Side-by-side orbit view, wireframe toggle |
| 📄 **Document** | ↔ | CSV, Excel, Word, PDF with cell/word diff |
| 📝 **Text** | ↔ | Character/word diff, syntax highlighting |

---

<h2 id="features">✨ Features at a Glance</h2>

<table>
<tr>
<td width="50%">

### 🎬 Video & Image
- Frame-by-frame navigation
- Synchronized playback (0.25x - 4x)
- Loop regions with I/O points
- Multi-clip timeline editing
- Clip trimming & positioning
- Filmstrip thumbnails on clips

</td>
<td width="50%">

### 🔬 Analysis Tools
- SSIM & PSNR metrics
- Delta E perceptual difference
- Pixel inspector (RGB/HSL)
- Histogram overlay
- Magnifier loupe
- Video scopes (Waveform, Vectorscope)

</td>
</tr>
<tr>
<td width="50%">

### 🎨 Professional Modes
- 15+ comparison modes
- 50+ WebGL analysis shaders
- False color exposure
- Focus peaking
- Zebra stripes
- Zone system (Ansel Adams)

</td>
<td width="50%">

### 📤 Export Options
- MP4, WebM, GIF formats
- 100+ GPU transitions
- Sweep animations
- Screenshots (PNG/JPEG)
- Up to 4K resolution
- PDF comparison reports

</td>
</tr>
<tr>
<td width="50%">

### 🎵 Audio Analysis
- Waveform visualization with playhead
- Goniometer / Stereo field display
- LUFS metering (EBU R128 / ITU-R BS.1770)
- True Peak & RMS measurement
- Phase correlation & stereo width
- Platform loudness targets (Spotify, YouTube, etc.)

</td>
<td width="50%">

### 💾 Project Management
- Auto-save to IndexedDB
- Multiple projects support
- Import/Export `.dualview` files
- Built-in & custom templates
- Undo/Redo history

</td>
</tr>
</table>

---

<h2 id="comparison-modes">🎯 Comparison Modes</h2>

DualView offers **15 unique comparison modes** to suit every workflow:

### Core Modes

| Mode | Key | Description |
|------|-----|-------------|
| **Slider** | `1` | Draggable divider reveals A/B — vertical or horizontal |
| **Side by Side** | `2` | Split view with synchronized playback |
| **Difference** | `3` | GPU-accelerated difference analysis (50+ modes) |
| **Audio** | `4` | Professional audio analysis (waveform, goniometer, LUFS metering) |
| **Prompt Diff** | `5` | Text comparison with syntax highlighting |
| **JSON Diff** | `6` | Structural JSON tree comparison |
| **3D Model** | `7` | GLB/GLTF model comparison with orbit controls |
| **Document** | `8` | CSV, Excel, Word, PDF comparison with cell/word diff |

### Advanced Modes

| Mode | Key | Description |
|------|-----|-------------|
| **Quad View** | `Q` | Four-panel layout for multi-angle comparison |
| **Radial Loupe** | `R` | Magnifying lens follows cursor |
| **Grid Tile** | `G` | Checkerboard interleaving of A/B |
| **Blend Modes** | — | Difference, Overlay, Multiply, Screen |
| **Split Screen** | — | Grid layouts: 2×1, 1×2, 2×2 |
| **Flicker** | — | Auto-alternating A/B for spotting changes |
| **Heatmap** | — | Pixel difference with color mapping |
| **Morphological** | — | Erosion, dilation, edge detection |

---

<h2 id="webgl-analysis">🔥 WebGL Analysis Engine</h2>

The heart of DualView is its **GPU-accelerated analysis engine** with **50+ GLSL shaders** organized into 8 categories:

<details>
<summary><strong>📊 Difference Analysis</strong> (10 modes)</summary>

| Mode | What it does |
|------|--------------|
| Absolute | RGB channel difference with amplification |
| Perceptual | Delta E in LAB color space — how humans see difference |
| Luminance | Brightness-only comparison |
| Chroma | Color-only comparison (ignores brightness) |
| Threshold | Binary mask at configurable threshold |
| Amplified | Magnify tiny differences 10x-100x |
| Wipe | Vertical/horizontal A↔B comparison |
| Split | Side-by-side 50/50 |
| Debug | Raw texture output for troubleshooting |

</details>

<details>
<summary><strong>🏗️ Structural Analysis</strong> (5 modes)</summary>

| Mode | What it does |
|------|--------------|
| SSIM Map | Local structural similarity visualization |
| Edge Comparison | Sobel edge detection difference |
| Gradient | Gradient magnitude comparison |
| Local Contrast | Contrast difference per region |
| Block Difference | Block-based comparison (compression artifacts) |

</details>

<details>
<summary><strong>🎨 Color Analysis</strong> (5 modes)</summary>

| Mode | What it does |
|------|--------------|
| Hue Difference | Color wheel position comparison |
| Saturation Map | Vibrance difference |
| False Color | Rainbow gradient for amplitude |
| Channel Split | R/G/B separated |
| Histogram Overlay | Distribution comparison |

</details>

<details>
<summary><strong>🎬 Professional Tools</strong> (6 modes)</summary>

| Mode | What it does |
|------|--------------|
| Anaglyph 3D | Red/cyan stereoscopic view |
| Checkerboard | Alternating pixel tiles |
| Onion Skin | Semi-transparent overlay |
| Loupe Wipe | Magnified wipe comparison |
| Frequency Split | Low/high frequency separation |
| Difference Mask | Use diff as alpha mask |

</details>

<details>
<summary><strong>🎥 Video-Specific</strong> (4 modes)</summary>

| Mode | What it does |
|------|--------------|
| Temporal Diff | Frame-to-frame changes |
| Motion Vectors | Optical flow approximation |
| Flicker Detection | Unstable pixel detection |
| Frame Blend | Temporal averaging |

</details>

<details>
<summary><strong>📐 Advanced Analysis</strong> (10+ modes)</summary>

| Mode | What it does |
|------|--------------|
| Multi-scale Edge | Laplacian pyramid edge comparison |
| Local Contrast | Standard deviation maps |
| Gradient Direction | Direction as hue visualization |
| Optical Flow | Motion vectors (8×8, 16×16, 32×32 blocks) |
| FFT Magnitude | Frequency spectrum analysis |
| Band-pass Filter | Low/high/band frequency isolation |
| Temporal Noise | Frame-to-frame noise analysis |
| Diff Accumulator | Motion history over time |

</details>

<details>
<summary><strong>📷 Exposure Tools</strong> (8 modes)</summary>

| Mode | Shortcut | What it does |
|------|----------|--------------|
| False Color | — | Exposure level visualization (cinema style) |
| Focus Peaking | `P` | Sharp edge highlighting |
| Zebra Stripes | `Z` | Overexposure warning (100 IRE) |
| Zone System | — | Ansel Adams exposure zones (0-X) |
| *All above with A vs B comparison variants* |

</details>

<details>
<summary><strong>⚖️ Perceptual Weighting</strong> (3 modes)</summary>

| Mode | What it does |
|------|--------------|
| Saliency | Visual attention importance |
| Edge Weighted | Edge-aware comparison |
| Weighted SSIM | Perceptually-weighted structural similarity |

</details>

---

## 🎵 Professional Audio Analysis

DualView includes a **broadcast-grade audio analysis suite** for comparing audio files:

### Visualization Modes

| Mode | Description |
|------|-------------|
| **All** | Dashboard view with all tools in a 2×2 grid |
| **Waveform** | Dual waveform display with playhead sync |
| **Loudness** | Side-by-side LUFS meters with platform targets |
| **Stereo** | Goniometer with phase correlation & width meters |
| **Analysis** | Frequency visualization overlay |

### Waveform Display

Interactive waveform visualization:

| Feature | Description |
|---------|-------------|
| **Dual Track** | A and B waveforms stacked vertically |
| **Playhead** | Synced playhead with click-to-seek |
| **Color Coded** | Orange for Track A, Lime for Track B |
| **Peak Display** | 500-sample peak visualization |

### Goniometer / Stereo Field

Professional stereo field visualization:

| Display | Purpose |
|---------|---------|
| **Lissajous Grid** | L/R axes with M/S reference lines |
| **Stereo Ellipse** | Width and correlation as ellipse shape |
| **Phase Correlation** | -1 (out of phase) to +1 (mono compatible) |
| **Stereo Width** | 0% (mono) to 100% (wide) |
| **Mid/Side Levels** | dB readout for M/S components |

### Loudness Metering (EBU R128)

Industry-standard loudness measurement:

| Metric | Standard | Description |
|--------|----------|-------------|
| **Integrated LUFS** | ITU-R BS.1770 | Full program loudness |
| **Momentary** | 400ms window | Short-term peaks |
| **Short-term** | 3s window | Rolling average |
| **True Peak** | dBTP | Intersample peak detection |
| **LRA** | Loudness Range | Dynamic range in LU |
| **RMS** | dBFS | Root mean square level |
| **Crest Factor** | dB | Peak to RMS ratio |

### Platform Loudness Targets

One-click compliance checking for major platforms:

| Platform | Target | Tolerance |
|----------|--------|-----------|
| Spotify | -14 LUFS | ±1 LU |
| YouTube | -14 LUFS | ±1 LU |
| Apple Music | -16 LUFS | ±1 LU |
| Amazon Music | -14 LUFS | ±1 LU |
| Broadcast (EBU R128) | -24 LUFS | ±1 LU |
| Cinema (SMPTE) | -27 LUFS | ±1 LU |
| Podcast | -16 LUFS | ±1 LU |

### Audio Shortcuts

| Key | Action |
|-----|--------|
| `A` | Solo Track A |
| `B` | Solo Track B |
| `S` | Play Both (A+B) |
| `Space` | Play/Pause |

---

## 📄 Document Comparison

Compare CSV, Excel, Word, and PDF documents with professional diff tools:

### Supported Formats

| Format | Extensions | Library |
|--------|------------|---------|
| **CSV** | `.csv` | PapaParse |
| **Excel** | `.xlsx`, `.xls` | SheetJS (xlsx) |
| **Word** | `.docx` | Mammoth.js |
| **PDF** | `.pdf` | PDF.js |

### CSV & Excel Comparison

| Feature | Description |
|---------|-------------|
| **Side-by-Side** | Tables A and B displayed next to each other |
| **Unified View** | Single table with inline diff highlighting |
| **Changes Only** | Filter to show only rows with differences |
| **Cell Diff** | Added (green), Removed (red), Modified (yellow) |
| **Sync Scroll** | Synchronized scrolling between A and B |
| **Statistics** | Row counts, change counts, match percentage |
| **Multi-Sheet** | Excel workbook sheet navigation |

### Word Document Comparison

| Feature | Description |
|---------|-------------|
| **Word-Level Diff** | Highlights individual word changes |
| **Side-by-Side** | Both documents with synced scrolling |
| **Unified View** | Single document with inline changes |
| **Changes Only** | Show only modified paragraphs |
| **Rich Formatting** | Preserves bold, italic, lists, tables |
| **Statistics** | Word counts, added/removed, similarity % |

### PDF Comparison

| Feature | Description |
|---------|-------------|
| **Visual Comparison** | Page-by-page image comparison |
| **Side-by-Side** | Both PDFs with page sync |
| **Overlay Mode** | Adjustable opacity overlay |
| **Slider Mode** | Draggable wipe comparison |
| **Text Comparison** | Extracted text with word diff |
| **Thumbnails** | Page overview with change indicators |
| **Statistics** | Page counts, similarity percentage |

---

<h2 id="export">📤 Export System</h2>

### Video Export

Export your comparisons as polished videos with professional transitions:

| Setting | Options |
|---------|---------|
| **Format** | MP4 • WebM • GIF |
| **Resolution** | 720p • 1080p • 4K |
| **Frame Rate** | 24 • 30 • 60 fps |
| **Quality** | Low • Medium • High |
| **Source** | Comparison • A Only • B Only |

### 🌀 100+ GPU Transitions

Export with stunning WebGL shader transitions:

| Category | Variants | Examples |
|----------|----------|----------|
| **Dissolve** | 8 | Powder, Ink, Cellular, Bokeh, Fractal, Sparkle |
| **Wipe** | 12 | Radial, Spiral, Clock, Iris, Diamond, Heart, Star |
| **Zoom** | 8 | Push, Pull, Dolly, Punch, Bounce, Elastic |
| **Blur** | 8 | Gaussian, Motion, Radial, Directional, Spin |
| **Rotate** | 8 | Flip, Spin, Cube, Fold, Swing |
| **Light** | 8 | Leak, Glow, Flare, Flash, Strobe |
| **Prism** | 8 | RGB Split, Spectral, Chromatic Aberration |
| **Glitch** | 8 | Scan, Tear, Block, Digital, VHS, Static |
| **Morph** | 8 | Warp, Liquify, Twist, Bulge, Wave, Ripple |
| **Pixelate** | 8 | Mosaic, Dither, Retro, 8-bit, Halftone |
| **Refraction** | 8 | Glass, Water, Crystal, Heat Haze |
| **Shutter** | 8 | Motion Lines, Echo, Trail, Persistence |
| **Other** | 12 | Kaleidoscope, Matrix, Film Burn, Comic |

### 🎬 Sweep Animations

| Style | Description |
|-------|-------------|
| Horizontal | Left-to-right wipe reveal |
| Vertical | Top-to-bottom wipe reveal |
| Diagonal | Corner-to-corner reveal |
| Circle | Expanding circular reveal |
| Rectangle | Expanding rectangular reveal |
| Spotlight | Bouncing rectangle (DVD screensaver) |
| Spotlight Circle | Bouncing circle |

### 📸 Screenshot Export

- **Formats:** PNG, JPEG (with quality control)
- **Resolutions:** 720p, 1080p, 4K
- **Sources:** Comparison view, A only, B only
- **Clipboard:** One-click copy

---

<h2 id="shortcuts">⌨️ Keyboard Shortcuts</h2>

DualView is built for speed. Master these shortcuts:

### Playback

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `←` `→` | Frame step (paused) or 1s seek |
| `Shift` + `←` `→` | 5s seek |
| `J` `K` `L` | Shuttle backward / stop / forward |
| `Home` | Jump to start |
| `End` | Jump to end |

### Loop & Markers

| Key | Action |
|-----|--------|
| `I` | Set loop in-point |
| `O` | Set loop out-point |
| `Escape` | Clear loop region |
| `M` | Add marker at playhead |

### Modes & Views

| Key | Action |
|-----|--------|
| `1` - `7` | Switch comparison modes |
| `Q` | Quad view |
| `R` | Radial loupe |
| `G` | Grid tile |
| `H` | Hide/show slider |
| `F` | Flip A/B (in WebGL mode) |
| `P` | Toggle focus peaking |
| `Z` | Toggle zebra stripes |
| `W` | Toggle video scopes |

### Interface

| Key | Action |
|-----|--------|
| `T` | Toggle timeline |
| `B` | Toggle sidebar |
| `E` | Open export dialog |
| `Shift` + `S` | Quick screenshot |
| `Shift` + `M` | Toggle quality metrics |
| `Ctrl/⌘` + `Z` | Undo |
| `Ctrl/⌘` + `Shift` + `Z` | Redo |
| `Ctrl/⌘` + `S` | Save project |
| `?` | Show all shortcuts |

---

## 🎨 Video Scopes

Professional broadcast-style monitoring tools:

| Scope | Purpose |
|-------|---------|
| **Histogram** | RGB/Luma distribution |
| **Color Wheel** | Vectorscope-style chrominance |
| **Gamut Warning** | Out-of-gamut pixel highlighting |

Toggle with `W` key.

---

## 💾 Project Management

- **Auto-save:** 500ms debounced saves to IndexedDB
- **Multiple projects:** Create, duplicate, delete
- **Import/Export:** `.dualview` JSON files with embedded media
- **Templates:** Built-in presets + custom templates
- **Metadata:** Title, description, tags

---

## 🛠️ Tech Stack

<table>
<tr>
<td>

| Core | Version |
|------|---------|
| React | 19.2.0 |
| TypeScript | 5.9.3 |
| Vite | 7.2.4 |
| Zustand | 5.0.9 |
| Tailwind CSS | 4.1.18 |

</td>
<td>

| Media | Technology |
|-------|------------|
| Video Encoding | WebCodecs API |
| MP4 Muxing | mp4-muxer |
| GIF Encoding | gif.js |
| 3D Rendering | Three.js |
| PDF Export | jsPDF |
| CSV Parsing | PapaParse |
| Excel Parsing | SheetJS (xlsx) |
| Word Parsing | Mammoth.js |
| PDF Parsing | PDF.js |

</td>
</tr>
</table>

---

<h2 id="getting-started">🚀 Getting Started</h2>

```bash
# Clone the repository
git clone https://github.com/gokayfem/dualview.git
cd dualview

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Requirements

- Node.js 18+
- Modern browser with WebGL 2.0 support
- WebCodecs API for video export (Chrome/Edge recommended)

---

## 📁 Project Structure

```
src/
├── components/
│   ├── comparison/        # 15+ comparison mode components
│   │   ├── SliderComparison.tsx
│   │   ├── SideBySide.tsx
│   │   ├── WebGLComparison.tsx    # 50+ GPU analysis modes
│   │   ├── AudioComparison.tsx    # Professional audio suite
│   │   ├── Model3DComparison.tsx  # GLB/GLTF support
│   │   ├── DocumentComparison.tsx # Document comparison wrapper
│   │   ├── CSVComparison.tsx      # CSV/spreadsheet diff
│   │   ├── ExcelComparison.tsx    # Excel workbook diff
│   │   ├── DOCXComparison.tsx     # Word document diff
│   │   ├── PDFComparison.tsx      # PDF visual/text diff
│   │   └── ...
│   ├── layout/            # Header, Sidebar, ExportDialog
│   ├── preview/           # Main preview canvas
│   ├── timeline/          # Timeline editor + clips
│   ├── scopes/            # Video scopes (histogram, vectorscope)
│   ├── audio/             # Audio waveform visualization
│   └── ui/                # Reusable components
├── stores/                # Zustand state management
│   ├── projectStore.ts    # Comparison settings
│   ├── mediaStore.ts      # Media files
│   ├── timelineStore.ts   # Tracks & clips
│   ├── playbackStore.ts   # Playback state
│   ├── historyStore.ts    # Undo/redo
│   └── persistenceStore.ts# Project save/load
├── hooks/                 # Custom React hooks
│   ├── useOptimizedVideoSync.ts   # Frame-accurate sync
│   ├── useSyncedZoom.ts           # Synchronized pan/zoom
│   └── ...
├── lib/
│   ├── webgl/
│   │   ├── shaders/       # 100+ transition shaders
│   │   └── comparison-shaders/    # 50+ analysis shaders
│   ├── audio/
│   │   ├── AudioAnalyzer.ts       # LUFS, RMS, phase correlation
│   │   ├── WebGLSpectrogramRenderer.ts   # GPU spectrogram
│   │   ├── WebGLGoniometerRenderer.ts    # Stereo vectorscope
│   │   └── WebGLSpectrumAnalyzer.ts      # Real-time FFT
│   ├── documentParser.ts  # CSV, Excel, DOCX, PDF parsing
│   ├── mp4Encoder.ts      # WebCodecs MP4 encoding
│   ├── gifEncoder.ts      # GIF encoding
│   └── metrics.ts         # SSIM/PSNR calculation
└── types/                 # TypeScript definitions
```

---

## 🎯 Use Cases

<table>
<tr>
<td width="50%">

### 🎨 Creative Professionals
- Before/after retouching
- Color grading comparison
- VFX render comparison
- Animation quality check

</td>
<td width="50%">

### 🤖 AI & ML
- Model output comparison
- Prompt iteration tracking
- Image generation A/B testing
- Upscaling quality analysis

</td>
</tr>
<tr>
<td width="50%">

### 🎮 Game Development
- Asset comparison
- LOD quality check
- Texture compression analysis
- 3D model comparison

</td>
<td width="50%">

### 🔍 Quality Assurance
- Visual regression testing
- Compression artifact detection
- Frame-by-frame verification
- Automated diff reports

</td>
</tr>
</table>

---

## 🌐 Browser Support

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome 94+ | ✅ Full | Best performance, WebCodecs |
| Edge 94+ | ✅ Full | Chromium-based |
| Firefox 100+ | ⚠️ Partial | No WebCodecs (GIF only) |
| Safari 16+ | ⚠️ Partial | Limited WebGL features |

---

<details>
<summary><strong>Cite this project</strong></summary>

If DualView supports your work, please cite the software. GitHub also provides
ready-to-copy APA and BibTeX entries via **Cite this repository**.

```bibtex
@software{Aydogan_DualView_2026,
  author  = {Aydoğan, Gökay},
  title   = {DualView},
  version = {1.0.0},
  year    = {2026},
  url     = {https://github.com/gokayfem/dualview}
}
```

[ORCID](https://orcid.org/0000-0002-2343-9433) · [Citation metadata](CITATION.cff)

</details>

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

Contributions welcome! Feel free to open issues and pull requests.

---

<p align="center">
  <sub>Built with love for creators who care about every pixel</sub>
</p>
