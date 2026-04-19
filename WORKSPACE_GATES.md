# 🏰 Workspace Gate-Centric Organization

## 🚪 Entry Gate System

### **Gate 1: Central Plaza (`~/workspace/`)
- **Function**: Universal entry point
- **Validation**: Health score ≥ 70%
- **Exit Protocol**: Commit pending changes before departure
- **Tools**: `CENTRAL_PLAZA.md`, health dashboard

### **Gate 2: Foundation Layer** (`roots/`)
- **Platform**: Python 3.13+, uv
- **Entry Command**: `uv sync --group dev --group test`
- **Validation**: Underscore isolation compliance
- **Compartment Districts**:
  - `GRID/` - AI/ML orchestration 🧠
  - `apiguard/` - Security gateway 🛡️
  - `Vision/` - Computer vision 👁️
  - `glimpse-engine/` - Internal tools 🔧

### **Gate 3: Product Layer** (`canopy/`)
- **Platform**: Mixed (TypeScript/Python)
- **Entry Validation**: Foundation layer operational
- **Compartment Districts**:
  - `afloat/` - Finance platform (Next.js) 💰
  - `echoes/` - Audio processing (FastAPI) 🔊
  - `assistive-agreement-contracts/` - Deployment variants 📝

### **Gate 4: Utility Layer** (`grove/`, `seed/`)
- **Platform**: Language-specific
- **Entry Validation**: Health score check
- **Compartment Districts**:
  - `grove/Vision/` - Active vision project 👁️
  - `grove/archive/` - Historical archives 📚
  - `seed/templates/` - Project templates 🎨

## 🛣️ Compartment Transition Protocols

### **Forward Flow (Build Order)**
1. **Gate 1** → Central Plaza health check
2. **Gate 2** → Build foundation (shared-types first)
3. **Gate 3** → Launch applications
4. **Gate 4** → Utility activation

### **Reverse Flow (Shutdown Order)**
1. **Gate 4** → Utility shutdown
2. **Gate 3** → Application stop
3. **Gate 2** → Foundation teardown
4. **Gate 1** → Final commit + audit

## 🎛️ VSCode Workspace Configuration

### **Primary Workspaces**
- `CascadeProjects.code-workspace` - Full ecosystem view
- `roots.code-workspace` - Foundation layer focus
- `canopy.code-workspace` - Product layer focus

### **Quick Navigation Keys**
```
Ctrl+Shift+1 → Full ecosystem
Ctrl+Shift+2 → Foundation layer  
Ctrl+Shift+3 → Product layer
Ctrl+Shift+C → Central Plaza
Ctrl+Shift+T → Status check
Ctrl+Shift+H → Health scan
```

### **Launch Configurations**
- `🏰 Launch Full Stack` - All core services
- `🛡️ Launch Security Stack` - GRID + apiguard
- Individual service launches per compartment

## 🔄 Cross-Compartment Communication

### **Environment Variables**
```bash
export GRID_API_URL=http://localhost:8080
export OLLAMA_BASE_URL=http://localhost:11434  
export ECHOES_AUDIT_PATH=~/.echoes/audit.ndjson
```

### **Data Contracts**
- **Audit Trail**: All MCP servers → `~/.echoes/audit.ndjson`
- **Health Scores**: `seeds-server` snapshots
- **Git Identity**: Auto-switch based on compartment

## 🚦 Health & Validation Gates

### **Pre-Flight Checks**
```bash
# District health scan
cd ~/workspace && find . -name 'README.md' -exec dirname {} \;

# Platform validation  
echo "afloat: $(test -f canopy/afloat/package.json && echo 'npm' || echo 'none')"
```

### **Post-Flight Validation**
- Git status clean before compartment exit
- Test coverage passing
- Audit trail recorded
- Health score ≥ threshold

## 🎨 Visual Organization

### **Color Coding**
- 🟢 **Green**: Active/Healthy (≥85%)
- 🟡 **Yellow**: Maintenance needed (70-84%)  
- 🔴 **Red**: Attention required (<70%)

### **Icons by Compartment**
- 🧠 **Foundation**: GRID, apiguard, Vision
- 💰 **Product**: afloat (finance), echoes (audio)
- 🔧 **Utility**: Tools, experiments, templates
- 📚 **Archive**: Historical, inactive projects

## ⚠️ Gate Enforcement Rules

### **Never Bypass**
- Build order sequence
- Underscore isolation in Python
- Network isolation boundaries
- Git identity separation

### **Always Validate**
- Health score before entry
- Tests passing before exit  
- Audit trail completeness
- Dependency consistency

---

**Next**: Run `Ctrl+Shift+T` for current status or `Ctrl+Shift+H` for health scan