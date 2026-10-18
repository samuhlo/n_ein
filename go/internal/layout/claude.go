package layout

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

func ClaudeRuntime(version string) (string, error) {
	if !piVersion.MatchString(version) {
		return "", fmt.Errorf("versión de Claude inválida: %s", version)
	}
	root, err := Root()
	if err != nil {
		return "", err
	}
	return filepath.Join(root, "runtimes", "claude", version), nil
}

func ClaudeBinary(version string) (string, error) {
	runtime, err := ClaudeRuntime(version)
	if err != nil {
		return "", err
	}
	return filepath.Join(runtime, "bin", "claude"), nil
}

// [FLOW] Claude que abre n_ein: override explícito → copia propia de runtimes/claude → el del sistema,
// solo donde no hay copia (desarrollo, paquetes anteriores). La configuración vive siempre en el hogar
// de n_ein, no en ~/.claude.
func Claude(source string) (bin, origin string) {
	if custom := os.Getenv("N_EIN_CLAUDE_BIN"); custom != "" {
		return custom, "N_EIN_CLAUDE_BIN"
	}
	var config struct {
		Claude struct {
			Version string `json:"version"`
		} `json:"claude"`
	}
	if data, err := os.ReadFile(filepath.Join(source, "runtime.json")); err == nil && json.Unmarshal(data, &config) == nil {
		if managed, err := ClaudeBinary(config.Claude.Version); err == nil {
			if _, err := os.Stat(managed); err == nil {
				return managed, "n_ein"
			}
		}
	}
	if system, err := exec.LookPath("claude"); err == nil {
		return system, "sistema"
	}
	return "", ""
}
