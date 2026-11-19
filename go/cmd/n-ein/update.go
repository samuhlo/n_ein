package main

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"

	tea "charm.land/bubbletea/v2"

	"n_ein/internal/layout"
	"n_ein/internal/release"
)

// =============================================================================
// [FLOW] AVISO DE VERSIÓN NUEVA
// El launcher pregunta a las releases de su canal en segundo plano: la portada
// nunca espera a la red. La respuesta se guarda unas horas porque la API de
// GitHub sin token admite 60 consultas por hora y por IP. Con la versión se lee
// su runtime.json para decir qué runtimes trae: el vigía de CI publica versiones
// que solo suben Pi, el puente, Claude Code o CodeGraph. Sus issues abiertos dicen
// qué versiones no publicó y por qué.
// =============================================================================

const updateCacheTTL = 6 * time.Hour

// updateFound es la versión nueva, si la hay, con los runtimes que fija (nil si no se pudo leer) y lo que
// el vigía dejó sin publicar (issues abiertos con la etiqueta runtimes).
type updateFound struct {
	version  string
	runtimes map[string]string
	pending  map[string]pendingRuntime
}

// pendingRuntime es una versión que el vigía no publicó: rompe n_ein (blocked) o espera revisión (review).
type pendingRuntime struct {
	Version string `json:"version"`
	Kind    string `json:"kind"`
}

type updateCache struct {
	Checked  time.Time                 `json:"checked"`
	Latest   string                    `json:"latest"`
	Runtimes map[string]string         `json:"runtimes,omitempty"`
	Pending  map[string]pendingRuntime `json:"pending,omitempty"`
}

// runtimeOrder y runtimeNames: cómo se nombra cada runtime en el aviso y su fila en Sistema.
var runtimeOrder = []string{"pi", "claude", "claudeBridge", "codegraph"}
var runtimeNames = map[string]string{"pi": "Pi", "claude": "Claude Code", "claudeBridge": "puente", "codegraph": "CodeGraph"}
var runtimeRows = map[string]string{"Pi": "pi", "Claude": "claude", "puente": "claudeBridge", "CodeGraph": "codegraph"}

// pinsFrom lee las versiones de runtimes de un runtime.json; las que faltan no aparecen.
// Cada runtime se lee por separado: el resto de claves de runtime.json tiene otra forma.
func pinsFrom(data []byte) map[string]string {
	pins := map[string]string{}
	var raw map[string]json.RawMessage
	if json.Unmarshal(data, &raw) != nil {
		return pins
	}
	for _, name := range runtimeOrder {
		var entry struct {
			Version string `json:"version"`
		}
		if json.Unmarshal(raw[name], &entry) == nil && entry.Version != "" {
			pins[name] = entry.Version
		}
	}
	return pins
}

// releaseRuntimes lee el runtime.json de una versión publicada, sin pasar por la API de GitHub.
func releaseRuntimes(version string) map[string]string {
	base := os.Getenv("N_EIN_RELEASE_RAW")
	if base == "" {
		base = "https://raw.githubusercontent.com/samuhlo/n_ein"
	}
	client := &http.Client{Timeout: 4 * time.Second}
	response, err := client.Get(strings.TrimRight(base, "/") + "/v" + version + "/runtime.json")
	if err != nil {
		return nil
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return nil
	}
	return pinsFrom(data)
}

// newerRelease devuelve la última versión del canal y sus runtimes si supera a la instalada (versión "" si no),
// y lo que el vigía dejó pendiente.
func newerRelease(channel, installed string, now time.Time) updateFound {
	current, err := release.Parse(installed)
	if err != nil || (channel != "preview" && channel != "stable") {
		return updateFound{}
	}
	cachePath := ""
	if root, err := layout.Root(); err == nil {
		cachePath = filepath.Join(root, "cache", "update-"+channel+".json")
	}
	var cached updateCache
	if data, err := os.ReadFile(cachePath); err != nil || json.Unmarshal(data, &cached) != nil || now.Sub(cached.Checked) >= updateCacheTTL {
		client := release.Client{API: os.Getenv("N_EIN_RELEASE_API"), HTTP: &http.Client{Timeout: 4 * time.Second}}
		chosen, err := client.Select(channel, "", runtime.GOOS+"-"+runtime.GOARCH)
		if err != nil {
			// Sin red o sin release no hay aviso; tampoco se guarda, para reintentar en la próxima apertura.
			return updateFound{}
		}
		cached = updateCache{Checked: now, Latest: chosen.Version}
		if next, err := release.Parse(chosen.Version); err == nil && next.Compare(current) > 0 {
			cached.Runtimes = releaseRuntimes(chosen.Version)
		}
		if issues, err := client.OpenIssues("runtimes"); err == nil {
			cached.Pending = pendingFrom(issues)
		}
		if data, err := json.Marshal(cached); err == nil && cachePath != "" {
			if os.MkdirAll(filepath.Dir(cachePath), 0o700) == nil {
				_ = os.WriteFile(cachePath, data, 0o600)
			}
		}
	}
	found := updateFound{pending: cached.Pending}
	if next, err := release.Parse(cached.Latest); err == nil && next.Compare(current) > 0 {
		found.version, found.runtimes = cached.Latest, cached.Runtimes
	}
	return found
}

func checkUpdate(channel, installed string) tea.Cmd {
	return func() tea.Msg {
		if found := newerRelease(channel, installed, time.Now()); found.version != "" || len(found.pending) > 0 {
			return found
		}
		return nil
	}
}

var runtimeMarker = regexp.MustCompile(`<!-- n_ein-runtimes (\{.*?\}) -->`)

// pendingFrom lee los marcadores que deja el vigía (scripts/runtimes/resolve.ts); por runtime, la versión más nueva.
func pendingFrom(issues []release.Issue) map[string]pendingRuntime {
	pending := map[string]pendingRuntime{}
	for _, issue := range issues {
		match := runtimeMarker.FindStringSubmatch(issue.Body)
		if match == nil {
			continue
		}
		var marker struct {
			Kind     string            `json:"kind"`
			Versions map[string]string `json:"versions"`
		}
		if json.Unmarshal([]byte(match[1]), &marker) != nil || (marker.Kind != "blocked" && marker.Kind != "review") {
			continue
		}
		for name, version := range marker.Versions {
			next, err := release.Parse(version)
			if err != nil {
				continue
			}
			if known, ok := pending[name]; ok {
				if old, err := release.Parse(known.Version); err == nil && old.Compare(next) >= 0 {
					continue
				}
			}
			pending[name] = pendingRuntime{Version: version, Kind: marker.Kind}
		}
	}
	return pending
}

// withPending anota en Sistema lo que el vigía no publicó y aún no está instalado; no ofrece actualizar.
func withPending(state appState, pending map[string]pendingRuntime) appState {
	var rows []row
	for _, name := range runtimeOrder {
		item, ok := pending[name]
		if !ok {
			continue
		}
		next, err := release.Parse(item.Version)
		if err != nil {
			continue
		}
		if local, err := release.Parse(state.home.runtimes[name]); err == nil && local.Compare(next) >= 0 {
			continue
		}
		reason := "necesita adaptar n_ein"
		if item.Kind == "review" {
			reason = "espera tu revisión del código"
		}
		rows = append(rows, row{"pendiente", runtimeNames[name] + " " + item.Version + " · " + reason, "issues runtimes", ""})
	}
	if len(rows) == 0 {
		return state
	}
	views := append([]panel(nil), state.views...)
	for i, panel := range views {
		if panel.title == "SISTEMA" {
			views[i].rows = append(append([]row(nil), panel.rows...), rows...)
		}
	}
	state.views = views
	return state
}

// runtimeChanges nombra los runtimes que la versión nueva cambia respecto a los instalados.
func runtimeChanges(local, remote map[string]string) []string {
	var changes []string
	for _, name := range runtimeOrder {
		if version := remote[name]; version != "" && version != local[name] {
			changes = append(changes, runtimeNames[name]+" "+version)
		}
	}
	return changes
}

// withUpdate pone «Actualizar» en cabeza del menú y lo anota en Sistema, con los runtimes que cambian.
func withUpdate(state appState, found updateFound) appState {
	version := found.version
	item := menuItem{"Actualizar", "→ " + version, "u", "update"}
	state.menu = append([]menuItem{item}, state.menu...)
	views := append([]panel(nil), state.views...)
	homeRows := []row{{item.label, item.note, item.key, item.action}}
	views[homeView].rows = append(homeRows, views[homeView].rows...)
	for i, panel := range views {
		rows := append([]row(nil), panel.rows...)
		for j, item := range rows {
			if item.label == "actualizaciones" {
				value := version + " disponible"
				if brings := runtimeChanges(state.home.runtimes, found.runtimes); len(brings) > 0 {
					value += " · trae " + strings.Join(brings, " · ")
				}
				rows[j] = row{"actualizaciones", value + " · u en la portada", "releases " + state.home.channel, "update"}
			}
			if name, ok := runtimeRows[item.label]; ok && panel.title == "SISTEMA" {
				if next := found.runtimes[name]; next != "" && next != state.home.runtimes[name] {
					rows[j].value = item.value + " → " + next + " con u"
				}
			}
		}
		views[i].rows = rows
	}
	state.views = views
	return state
}

// blinkSeconds es lo que dura el parpadeo; después el aviso queda fijo y la portada deja de redibujarse.
const blinkSeconds = 1.2

// blink dice si el aviso se ve: aparece, se apaga y vuelve dos veces, y se queda.
func blink(seconds float64) bool {
	return seconds >= blinkSeconds || int(seconds/0.3)%2 == 0
}
