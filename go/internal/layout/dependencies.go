package layout

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// DependencyPath mantiene en Go la lectura del manifiesto antes de tener Bun.
func DependencyPath(source string) (string, error) {
	data, err := os.ReadFile(filepath.Join(source, "runtime.json"))
	if err != nil {
		return "", err
	}
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return "", err
	}
	config := map[string]struct {
		Version string `json:"version"`
	}{}
	for _, name := range []string{"node", "bun"} {
		if b, ok := raw[name]; ok {
			var pin struct {
				Version string `json:"version"`
			}
			if err := json.Unmarshal(b, &pin); err != nil {
				return "", err
			}
			config[name] = pin
		}
	}

	root, err := Root()
	if err != nil {
		return "", err
	}
	paths := []string{}
	for _, name := range []string{"node", "bun"} {
		if pin, ok := config[name]; ok {
			if !piVersion.MatchString(pin.Version) {
				return "", fmt.Errorf("versión de %s inválida", name)
			}
			paths = append(paths, filepath.Join(root, "runtimes", name, pin.Version, "bin"))
		}
	}
	paths = append(paths, os.Getenv("PATH"))
	return strings.Join(paths, string(os.PathListSeparator)), nil
}
func UseDependencies(source string) error {
	path, err := DependencyPath(source)
	if err != nil {
		return err
	}
	return os.Setenv("PATH", path)
}
