// =============================================================================
// [FLOW] REVISOR DESDE EL LAUNCHER
// `nein previewer` y la entrada del Panel pasan por bin/n-ein-previewer. El
// launcher no lee el almacén, solo el resumen que da `status`, y una revisión
// solo empieza cuando el usuario la elige: cuesta modelo y tiempo.
// =============================================================================
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"syscall"
)

type previewerStatus struct {
	Head       string  `json:"head"`
	Reviewable bool    `json:"reviewable"`
	Session    *string `json:"session"`
	Reviewed   *string `json:"reviewed"`
	Current    int     `json:"current"`
}

func readPreviewer(root, project string) (previewerStatus, bool) {
	bin := filepath.Join(root, "bin", "n-ein-previewer")
	if _, err := os.Stat(bin); err != nil {
		return previewerStatus{}, false
	}
	var status previewerStatus
	if err := json.Unmarshal([]byte(command(project, bin, "status")), &status); err != nil || status.Head == "" {
		return previewerStatus{}, false
	}
	return status, true
}

// previewerItem abre lo ya revisado y propone revisar cuando el head no lo está.
func previewerItem(status previewerStatus, ok bool) menuItem {
	item := menuItem{label: "Revisor", key: "r"}
	switch {
	case !ok:
		item.note = "no disponible"
	case status.Reviewed != nil && *status.Reviewed == status.Head:
		item.action = "previewer:open"
		switch status.Current {
		case 0:
			item.note = "sin hallazgos"
		case 1:
			item.note = "1 vigente"
		default:
			item.note = fmt.Sprintf("%d vigentes", status.Current)
		}
	case !status.Reviewable:
		item.note = "sin cambios propios"
	case status.Reviewed != nil:
		item.note, item.action = "volver a revisar", "previewer:review"
	default:
		item.note, item.action = "revisar la rama", "previewer:review"
	}
	return item
}

// launchPreviewer cede el proceso al revisor: ctrl+c le llega directo, cancela la revisión y borra su copia.
func launchPreviewer(packageRoot, project string, args []string) error {
	if len(args) == 0 {
		args = []string{"open"}
	}
	bin := filepath.Join(packageRoot, "bin", "n-ein-previewer")
	if err := os.Chdir(project); err != nil {
		return err
	}
	return syscall.Exec(bin, append([]string{bin}, args...), os.Environ())
}

// launchWork abre el encargo portable con el mismo hogar y ejecutor del paquete.
func launchWork(packageRoot, project string, args []string) error {
	if len(args) == 0 {
		args = []string{"status"}
	}
	bin := filepath.Join(packageRoot, "bin", "n-ein-work")
	if err := os.Chdir(project); err != nil {
		return err
	}
	return syscall.Exec(bin, append([]string{bin}, args...), os.Environ())
}
