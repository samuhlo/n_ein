package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// =============================================================================
// [FLOW] LIMPIEZA TRAS ACTUALIZAR
// Cada versión instala sus runtimes junto a los anteriores y cada actualización
// deja un backup de la instalación. Se conservan los runtimes de cada instalación
// y de su backup más reciente, el que restaura «volver a la versión anterior»,
// y los tres backups más nuevos. Solo se borra lo que lleva marcador de n_ein.
// =============================================================================

const keptBackups = 3

// runtimeDirs traduce las claves de runtime.json a las carpetas de runtimes/.
var runtimeDirs = map[string]string{"pi": "pi", "claude": "claude", "claudeBridge": "claude-bridge", "codegraph": "codegraph", "node": "node", "bun": "bun"}

func runtimeRefs(path string, into map[string]bool) {
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	var raw map[string]json.RawMessage
	if json.Unmarshal(data, &raw) != nil {
		return
	}
	for key, dir := range runtimeDirs {
		var entry struct {
			Version string `json:"version"`
		}
		if json.Unmarshal(raw[key], &entry) == nil && entry.Version != "" {
			into[dir+"/"+entry.Version] = true
		}
	}
}

// backupDirs devuelve los backups de una instalación con ese prefijo, del más nuevo al más viejo.
func backupDirs(target, prefix string) []string {
	entries, err := os.ReadDir(target + ".backups")
	if err != nil {
		return nil
	}
	var dirs []string
	for _, entry := range entries {
		if entry.IsDir() && strings.HasPrefix(entry.Name(), prefix) {
			dirs = append(dirs, filepath.Join(target+".backups", entry.Name()))
		}
	}
	sort.Sort(sort.Reverse(sort.StringSlice(dirs)))
	return dirs
}

func ownedRuntime(dir string) bool {
	for _, marker := range []string{"runtime-install.json", "dependency.json"} {
		if _, err := os.Stat(filepath.Join(dir, marker)); err == nil {
			return true
		}
	}
	return false
}

// prune borra runtimes sin uso y backups antiguos del hogar; devuelve cuántos de cada.
func prune(home string) (runtimes, copies int, err error) {
	installations := filepath.Join(home, "installations")
	entries, err := os.ReadDir(installations)
	if err != nil {
		return 0, 0, err
	}
	keep := map[string]bool{}
	for _, entry := range entries {
		name := entry.Name()
		if !entry.IsDir() || strings.HasPrefix(name, ".") || strings.HasSuffix(name, ".backups") {
			continue
		}
		target := filepath.Join(installations, name)
		runtimeRefs(filepath.Join(target, "runtime.json"), keep)
		kept, previous := 0, false
		for _, dir := range backupDirs(target, "backup-") {
			// BLINDAJE -> Solo se borra una copia que se identifica como instalación de n_ein.
			if managed(dir) != nil {
				continue
			}
			if !previous {
				runtimeRefs(filepath.Join(dir, "runtime.json"), keep)
				previous = true
			}
			if kept++; kept > keptBackups {
				if err := os.RemoveAll(dir); err != nil {
					return runtimes, copies, err
				}
				copies++
			}
		}
		// recovery-* es la versión que sustituyó un restore: basta con la última.
		for index, dir := range backupDirs(target, "recovery-") {
			if index > 0 && managed(dir) == nil {
				if err := os.RemoveAll(dir); err != nil {
					return runtimes, copies, err
				}
				copies++
			}
		}
	}
	// Sin ninguna referencia no se sabe qué está en uso: un hogar a medias no se vacía.
	if len(keep) == 0 {
		return runtimes, copies, fmt.Errorf("ninguna instalación declara sus runtimes en %s", installations)
	}
	kinds, err := os.ReadDir(filepath.Join(home, "runtimes"))
	if err != nil {
		return runtimes, copies, nil
	}
	for _, kind := range kinds {
		if !kind.IsDir() {
			continue
		}
		versions, err := os.ReadDir(filepath.Join(home, "runtimes", kind.Name()))
		if err != nil {
			continue
		}
		for _, version := range versions {
			name := version.Name()
			if !version.IsDir() || strings.HasPrefix(name, ".") || strings.HasSuffix(name, ".backups") || keep[kind.Name()+"/"+name] {
				continue
			}
			dir := filepath.Join(home, "runtimes", kind.Name(), name)
			if !ownedRuntime(dir) {
				continue
			}
			if err := os.RemoveAll(dir); err != nil {
				return runtimes, copies, err
			}
			// Los backups de una copia dañada de esa versión tampoco sirven ya.
			_ = os.RemoveAll(dir + ".backups")
			runtimes++
		}
	}
	return runtimes, copies, nil
}
