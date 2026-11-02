# Contributing to ResearchLoom (Samhita)

Thank you for your interest in contributing to **ResearchLoom**! We welcome community contributions to improve our literature synthesis algorithms, visual stylus studio, tablet hardware integration, and academic workflows.

---

## 🛠️ Code of Conduct

All contributors and participants are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please treat all community members with respect and constructive professionalism.

---

## 🚀 Getting Started

### 1. Repository Setup
```bash
git clone https://github.com/sohamsans/researchloom.git
cd researchloom
```

### 2. Frontend Development (React + TypeScript + Vite)
```bash
cd frontend
npm install
npm run dev
```

### 3. Backend Development (FastAPI + Python 3.12)
```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

---

## 🧪 Quality Assurance & Coding Standards

To ensure code health and prevent regressions, all pull requests must meet the following criteria:

- **Type Safety**: Strictly typed TypeScript (`npm run build` or `npx tsc --noEmit`) with zero unresolved type errors.
- **Python Quality**: Python code formatted and linted (FastAPI, Pydantic schemas, strict async error handling).
- **Zero AI Slop**: Retain ResearchLoom's restrained, functional dark matte UI (`#07080a`). Avoid generic neon gradients, excessive animations, or cluttered cards.
- **Token Efficiency**: Literature extraction and synthesis flows must conserve API tokens and prevent latency spikes.

---

## 📬 Pull Request Workflow

1. Fork the repository and create a feature branch (`git checkout -b feat/my-feature`).
2. Make your changes with focused, descriptive commits following Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`).
3. Test thoroughly on desktop and tablet viewport modes.
4. Push to your fork and submit a Pull Request targeting `main`.
5. Clearly describe the problem solved, architectural changes made, and include screenshots or GIFs for UI updates.
