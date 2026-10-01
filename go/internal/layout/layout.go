// Package layout names the code and runtime homes managed by n_ein.
package layout

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
)

// piVersion acepta versiones semánticas fijas; vale también para CodeGraph.
var piVersion = regexp.MustCompile(`^[0-9]+\.[0-9]+\.[0-9]+$`)

func Root() (string, error) {
	if custom := os.Getenv("N_EIN_HOME"); custom != "" {
		return filepath.Abs(custom)
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".n_ein"), nil
}

func PiRuntime(version string) (string, error) {
	if !piVersion.MatchString(version) {
		return "", fmt.Errorf("versión de Pi inválida: %s", version)
	}
	root, err := Root()
	if err != nil {
		return "", err
	}
	return filepath.Join(root, "runtimes", "pi", version), nil
}

func PiBinary(version string) (string, error) {
	runtime, err := PiRuntime(version)
	if err != nil {
		return "", err
	}
	return filepath.Join(runtime, "bin", "pi"), nil
}

func CodeGraphRuntime(version string) (string, error) {
	if !piVersion.MatchString(version) {
		return "", fmt.Errorf("versión de CodeGraph inválida: %s", version)
	}
	root, err := Root()
	if err != nil {
		return "", err
	}
	return filepath.Join(root, "runtimes", "codegraph", version), nil
}

func CodeGraphBinary(version string) (string, error) {
	runtime, err := CodeGraphRuntime(version)
	if err != nil {
		return "", err
	}
	return filepath.Join(runtime, "bin", "codegraph"), nil
}

func Installation(channel string) (string, error) {
	if channel != "preview" && channel != "stable" {
		return "", fmt.Errorf("canal no instalable: %s", channel)
	}
	root, err := Root()
	if err != nil {
		return "", err
	}
	return filepath.Join(root, "installations", channel), nil
}
