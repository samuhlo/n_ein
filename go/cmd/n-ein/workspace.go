// [DATA] RESÚMENES DE TRABAJO PUBLICADOS
// El Panel lee la CLI del paquete; no interpreta conversaciones ni bloquea sesiones.
package main

import (
	"encoding/json"
	"path/filepath"
	"strings"
)

type publishedSession struct {
	ID         string `json:"id"`
	Runtime    string `json:"runtime"`
	Objective  string `json:"objective"`
	Progress   string `json:"progress"`
	Next       string `json:"next"`
	Status     string `json:"status"`
	RecordedAt string `json:"recordedAt"`
	Stale      bool   `json:"stale"`
}

func publishedSessions(root, project string) []publishedSession {
	var result struct {
		Sessions []publishedSession `json:"sessions"`
	}
	if json.Unmarshal([]byte(command(project, filepath.Join(root, "bin", "n-ein-work"), "sessions", "--json")), &result) != nil {
		return nil
	}
	return result.Sessions
}

func sessionNote(s publishedSession) string {
	parts := []string{s.Objective, s.Progress, s.Next}
	var present []string
	for _, p := range parts {
		if p != "" {
			present = append(present, strings.Join(strings.Fields(p), " "))
		}
	}
	if s.Stale {
		present = append(present, "resumen antiguo")
	}
	return strings.Join(present, " · ")
}
