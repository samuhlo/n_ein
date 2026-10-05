package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"

	"n_ein/internal/layout"
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
// Devuelve la configuración efectiva y, por rol, si su valor viene de runtime.json o de models.json.
func applyModelSelections(config runtimeConfig, channel string) (runtimeConfig, map[string]string, error) {
	sources := map[string]string{"principal": "runtime.json", "scout": "runtime.json", "worker": "runtime.json", "reviewer": "runtime.json",
		"mecanico": "runtime.json", "ordinario": "runtime.json", "riesgo": "runtime.json", "abierto": "runtime.json"}
	path := os.Getenv("N_EIN_MODELS_FILE")
	if path == "" {
		home, err := layout.Root()
		if err != nil {
			return config, sources, err
		}
		path = filepath.Join(home, channel, "models.json")
	}
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return config, sources, nil
	}
	if err != nil {
		return config, sources, err
	}
	var settings struct {
		Schema int                       `json:"schema"`
		Agents map[string]modelSelection `json:"agents"`
		Claude *struct {
			Effort string `json:"effort"`
		} `json:"claude"`
	}
	if json.Unmarshal(data, &settings) != nil || settings.Schema != 1 || settings.Agents == nil {
		return config, sources, fmt.Errorf("models.json inválido")
	}
	for role, value := range settings.Agents {
		if !validModelSelection(value) {
			return config, sources, fmt.Errorf("models.json inválido: %s", role)
		}
	}
	// Claude no elige modelo en n_ein: solo su esfuerzo, con los niveles que acepta Claude Code.
	if settings.Claude != nil {
		switch settings.Claude.Effort {
		case "low", "medium", "high", "xhigh", "max":
			config.Claude.Effort = settings.Claude.Effort
		default:
			return config, sources, fmt.Errorf("models.json inválido: claude")
		}
	}
	targets := map[string]*modelSelection{"scout": &config.Scout, "worker": &config.Worker, "reviewer": &config.Reviewer}
	// La tabla se copia antes de tocarla: el mapa de runtime.json no debe cambiar por los ajustes del canal.
	routing := make(map[string]modelSelection, len(config.Routing))
	for class, value := range config.Routing {
		routing[class] = value
	}
	config.Routing = routing
	for role, value := range settings.Agents {
		if role == "principal" {
			config.Pi.Model, config.Pi.Thinking = value.Model, value.Thinking
		} else if target, ok := targets[role]; ok {
			*target = value
		} else if _, ok := sources[role]; ok {
			config.Routing[role] = value
		} else {
			continue
		}
		sources[role] = "models.json"
	}
	return config, sources, nil
}
