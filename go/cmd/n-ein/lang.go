package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"n_ein/internal/layout"
)

// [DATA] Idioma en dos ejes, como en Ein. Mismo archivo y valores que pi-package/lang.ts,
// que es quien lo convierte en instrucción para el agente.
type langSettings struct {
	Chat      string `json:"chat"`
	Artifacts string `json:"artifacts"`
}

var langCycles = map[string][]string{
	"chat":      {"es", "en"},
	"artifacts": {"proyecto", "es", "en"},
}

var langLabels = map[string]string{"es": "español", "en": "inglés", "proyecto": "el del proyecto"}

func langPath(channel string) (string, error) {
	if custom := os.Getenv("N_EIN_LANG_FILE"); custom != "" {
		return custom, nil
	}
	root, err := layout.Root()
	if err != nil {
		return "", err
	}
	return filepath.Join(root, channel, "lang.json"), nil
}

func contains(values []string, value string) bool {
	for _, item := range values {
		if item == value {
			return true
		}
	}
	return false
}

// readLang devuelve los ajustes y si vienen del archivo (false = valores por defecto).
func readLang(channel string) (langSettings, bool, error) {
	defaults := langSettings{Chat: "es", Artifacts: "proyecto"}
	path, err := langPath(channel)
	if err != nil {
		return defaults, false, err
	}
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return defaults, false, nil
	}
	if err != nil {
		return defaults, false, err
	}
	var value langSettings
	if json.Unmarshal(data, &value) != nil || !contains(langCycles["chat"], value.Chat) || !contains(langCycles["artifacts"], value.Artifacts) {
		return defaults, false, fmt.Errorf("lang.json inválido")
	}
	return value, true, nil
}

// cycleLang avanza un eje al siguiente valor y lo guarda de forma atómica.
func cycleLang(channel, axis string) (langSettings, error) {
	current, _, err := readLang(channel)
	if err != nil {
		return current, err
	}
	values := langCycles[axis]
	next := func(value string) string {
		for i, item := range values {
			if item == value {
				return values[(i+1)%len(values)]
			}
		}
		return values[0]
	}
	switch axis {
	case "chat":
		current.Chat = next(current.Chat)
	case "artifacts":
		current.Artifacts = next(current.Artifacts)
	default:
		return current, fmt.Errorf("eje de idioma desconocido: %s", axis)
	}
	path, err := langPath(channel)
	if err != nil {
		return current, err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return current, err
	}
	data, err := json.MarshalIndent(current, "", "  ")
	if err != nil {
		return current, err
	}
	temporary := path + ".tmp"
	if err := os.WriteFile(temporary, append(data, '\n'), 0o600); err != nil {
		return current, err
	}
	return current, os.Rename(temporary, path)
}

func langRows(channel string) []row {
	value, saved, err := readLang(channel)
	if err != nil {
		return []row{{"conversación", err.Error(), "lang.json", ""}, {"artefactos", err.Error(), "lang.json", ""}}
	}
	source := "por defecto"
	if saved {
		source = "lang.json"
	}
	return []row{
		{"conversación", langLabels[value.Chat] + " · enter cambia", source, "cycle:chat"},
		{"artefactos", langLabels[value.Artifacts] + " · enter cambia", source, "cycle:artifacts"},
	}
}
