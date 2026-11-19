package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// =============================================================================
// [FLOW] VOLVER A LA VERSIÓN ANTERIOR
// Cada actualización deja la instalación previa en <instalación>.backups. El
// launcher la ofrece en Sistema y el instalador la restaura con `restore`; los
// runtimes de esa versión siguen en runtimes/ porque la limpieza los conserva.
// =============================================================================

// previousInstall es la versión del backup que restauraría el instalador: el backup-* más reciente con install.json.
func previousInstall(root string) string {
	entries, err := os.ReadDir(root + ".backups")
	if err != nil {
		return ""
	}
	var names []string
	for _, entry := range entries {
		if entry.IsDir() && strings.HasPrefix(entry.Name(), "backup-") {
			names = append(names, entry.Name())
		}
	}
	sort.Strings(names)
	for i := len(names) - 1; i >= 0; i-- {
		var install struct {
			Version string `json:"version"`
		}
		data, err := os.ReadFile(filepath.Join(root+".backups", names[i], "install.json"))
		if err == nil && json.Unmarshal(data, &install) == nil && install.Version != "" {
			return install.Version
		}
	}
	return ""
}

// confirmRestore pregunta fuera de la TUI: volver atrás exige un sí explícito.
func confirmRestore(in io.Reader, out io.Writer, current, previous string) bool {
	fmt.Fprintf(out, "\n  Volver de %s a %s.\n  Las sesiones creadas con un Pi más nuevo pueden no abrirse con el anterior.\n  ¿Seguir? [s/N] ", current, previous)
	answer, _ := bufio.NewReader(in).ReadString('\n')
	switch strings.ToLower(strings.TrimSpace(answer)) {
	case "s", "si", "sí", "y", "yes":
		return true
	}
	return false
}
