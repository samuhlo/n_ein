package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
)

type modelSelection struct {
	Model    string `json:"model"`
	Thinking string `json:"thinking"`
}

var modelIdentifier = regexp.MustCompile(`^[A-Za-z0-9._-]+/[A-Za-z0-9._:/+-]+$`)

func validModelSelection(value modelSelection) bool {
	if !modelIdentifier.MatchString(value.Model) {
		return false
	}
	switch value.Thinking {
	case "off", "minimal", "low", "medium", "high", "xhigh", "max":
		return true
	default:
		return false
	}
}

// [DATA] Los ajustes del canal sobreviven al reemplazo del paquete instalado.
func applyModelSelections(config runtimeConfig, channel string) (runtimeConfig, string, string, error) {
	path := os.Getenv("N_EIN_MODELS_FILE")
	if path == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return config, "runtime.json", "runtime.json", err
		}
		path = filepath.Join(home, ".n_ein", channel, "models.json")
	}
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return config, "runtime.json", "runtime.json", nil
	}
	if err != nil {
		return config, "runtime.json", "runtime.json", err
	}
	var settings struct {
		Schema int                       `json:"schema"`
		Agents map[string]modelSelection `json:"agents"`
	}
	if json.Unmarshal(data, &settings) != nil || settings.Schema != 1 || settings.Agents == nil {
		return config, "models.json", "models.json", fmt.Errorf("models.json inválido")
	}
	for role, value := range settings.Agents {
		if !validModelSelection(value) {
			return config, "models.json", "models.json", fmt.Errorf("models.json inválido: %s", role)
		}
	}
	piSource, workerSource := "runtime.json", "runtime.json"
	if value, ok := settings.Agents["principal"]; ok {
		config.Pi.Model, config.Pi.Thinking = value.Model, value.Thinking
		piSource = "models.json"
	}
	if value, ok := settings.Agents["worker"]; ok {
		config.Worker.Model, config.Worker.Thinking = value.Model, value.Thinking
		workerSource = "models.json"
	}
	return config, piSource, workerSource, nil
}
