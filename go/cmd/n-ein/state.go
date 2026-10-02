package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"n_ein/internal/layout"
)

type row struct {
	label  string
	value  string
	source string
	action string
}

type panel struct {
	number int
	title  string
	rows   []row
}

// menuItem es una entrada de la portada: lo que se viene a hacer, con su atajo.
type menuItem struct {
	label  string
	note   string
	key    string
	action string
}

// homeContext es el estado que la portada enseña bajo la marca; no son filas porque no se eligen.
type homeContext struct {
	name    string
	branch  string
	changes string
	root    string
	channel string
	version string
}

type runtimeConfig struct {
	Pi struct {
		Version  string `json:"version"`
		Model    string `json:"model"`
		Thinking string `json:"thinking"`
	} `json:"pi"`
	Scout     modelSelection `json:"scout"`
	Worker    modelSelection `json:"worker"`
	Reviewer  modelSelection `json:"reviewer"`
	CodeGraph struct {
		Version string `json:"version"`
	} `json:"codegraph"`
	// Claude no viene de runtime.json: solo existe si el usuario fijó su esfuerzo en models.json.
	Claude struct {
		Effort string `json:"-"`
	} `json:"-"`
}

type appState struct {
	views []panel
	menu  []menuItem
	home  homeContext
}

func readJSON(path string, target any) bool {
	data, err := os.ReadFile(path)
	return err == nil && json.Unmarshal(data, target) == nil
}

func command(cwd, name string, args ...string) string {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Dir = cwd
	data, err := cmd.Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(data))
}

func known(value string) string {
	if strings.TrimSpace(value) == "" {
		return "desconocido"
	}
	return value
}

func workSection(content, title string) string {
	lines := strings.Split(strings.ReplaceAll(content, "\r\n", "\n"), "\n")
	start := -1
	for i, line := range lines {
		if strings.EqualFold(strings.TrimSpace(line), "## "+title) {
			start = i + 1
			break
		}
	}
	if start < 0 {
		return ""
	}
	var body []string
	for _, line := range lines[start:] {
		if strings.HasPrefix(line, "## ") {
			break
		}
		body = append(body, line)
	}
	return strings.TrimSpace(strings.Join(body, "\n"))
}

func workState(project string) (objective, tasks, current, evidence string) {
	path := filepath.Join(project, "WORK.md")
	data, err := os.ReadFile(path)
	if err != nil {
		return "sin documento", "sin documento", "sin documento", "desconocida"
	}
	content := string(data)
	objectiveText := workSection(content, "Objetivo")
	if objectiveText == "" {
		objectiveText = workSection(content, "Acuerdo confirmado")
	}
	objective = known(strings.Split(objectiveText, "\n")[0])
	taskSection := workSection(content, "Tareas")
	if taskSection == "" {
		taskSection = workSection(content, "Checklist")
	}
	total, done := 0, 0
	for _, line := range strings.Split(taskSection, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "- [x] ") || strings.HasPrefix(trimmed, "- [X] ") {
			total++
			done++
		} else if strings.HasPrefix(trimmed, "- [ ] ") {
			total++
			if current == "" {
				current = strings.TrimPrefix(trimmed, "- [ ] ")
			}
		}
	}
	if total == 0 {
		tasks, current = "sin tareas", "sin tareas"
	} else {
		tasks = fmt.Sprintf("%d/%d hechas", done, total)
		if current == "" {
			current = "todo completado"
		}
	}
	if workSection(content, "Evidencia") == "" {
		evidence = "sin comprobaciones"
	} else {
		evidence = "consignada · vigencia desconocida"
	}
	return
}

type session struct {
	runtime string
	last    string
	when    time.Time
	path    string
	id      string
}

func messageText(raw json.RawMessage) string {
	var text string
	if json.Unmarshal(raw, &text) == nil {
		return text
	}
	var parts []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}
	if json.Unmarshal(raw, &parts) != nil {
		return ""
	}
	for _, part := range parts {
		if part.Type == "text" && part.Text != "" {
			return part.Text
		}
	}
	return ""
}

func commandRequest(text string) string {
	nameStart := strings.Index(text, "<command-name>")
	nameEnd := strings.Index(text, "</command-name>")
	if nameStart < 0 || nameEnd <= nameStart {
		return text
	}
	name := text[nameStart+len("<command-name>") : nameEnd]
	argsStart := strings.Index(text, "<command-args>")
	argsEnd := strings.Index(text, "</command-args>")
	if argsStart >= 0 && argsEnd > argsStart {
		return name + " " + text[argsStart+len("<command-args>"):argsEnd]
	}
	return name
}

func sessionRequest(path string) (string, string) {
	file, err := os.Open(path)
	if err != nil {
		return "", ""
	}
	defer file.Close()
	scan := bufio.NewScanner(file)
	scan.Buffer(make([]byte, 64*1024), 4*1024*1024)
	last, cwd := "", ""
	for scan.Scan() {
		var event struct {
			Type   string `json:"type"`
			Cwd    string `json:"cwd"`
			Origin struct {
				Kind string `json:"kind"`
			} `json:"origin"`
			Message struct {
				Role    string          `json:"role"`
				Content json.RawMessage `json:"content"`
			} `json:"message"`
		}
		if json.Unmarshal(scan.Bytes(), &event) != nil {
			continue
		}
		if cwd == "" && event.Cwd != "" {
			cwd = event.Cwd
		}
		if (event.Type == "message" || event.Type == "user" && event.Origin.Kind == "human") && event.Message.Role == "user" {
			if text := strings.TrimSpace(messageText(event.Message.Content)); text != "" {
				last = commandRequest(text)
			}
		}
	}
	return cwd, last
}

func canonical(path string) string {
	if actual, err := filepath.EvalSymlinks(path); err == nil {
		return actual
	}
	return filepath.Clean(path)
}

func sessionID(path string) string {
	base := strings.TrimSuffix(filepath.Base(path), ".jsonl")
	if index := strings.LastIndex(base, "_"); index >= 0 {
		base = base[index+1:]
	}
	if len(base) == 36 && strings.Count(base, "-") == 4 {
		return base
	}
	return ""
}

func recentSessions(channel, project string) []session {
	base, err := layout.Root()
	if err != nil {
		return nil
	}
	base = filepath.Join(base, channel)
	piHome := os.Getenv("N_EIN_AGENT_DIR")
	if piHome == "" {
		piHome = filepath.Join(base, "pi-agent")
	}
	claudeHome := os.Getenv("N_EIN_CLAUDE_DIR")
	if claudeHome == "" {
		claudeHome = filepath.Join(base, "claude")
	}
	paths := []struct{ runtime, dir string }{
		{"Pi", filepath.Join(piHome, "sessions")},
		{"Claude", filepath.Join(claudeHome, "projects")},
	}
	var found []session
	for _, source := range paths {
		_ = filepath.WalkDir(source.dir, func(path string, entry os.DirEntry, err error) error {
			if err != nil || entry.IsDir() || !strings.HasSuffix(path, ".jsonl") {
				return nil
			}
			info, err := entry.Info()
			if err == nil {
				found = append(found, session{runtime: source.runtime, when: info.ModTime(), path: path})
			}
			return nil
		})
	}
	sort.Slice(found, func(i, j int) bool { return found[i].when.After(found[j].when) })
	var selected []session
	for _, item := range found {
		cwd, request := sessionRequest(item.path)
		if cwd == "" || canonical(cwd) != canonical(project) {
			continue
		}
		item.last = known(request)
		item.id = sessionID(item.path)
		selected = append(selected, item)
		if len(selected) == 5 {
			break
		}
	}
	return selected
}

func claudeRow(effort string, modelError error) row {
	switch {
	case modelError != nil:
		return row{"claude", modelError.Error(), "models.json", ""}
	case effort == "":
		return row{"claude", "modelo de Claude Code · esfuerzo por defecto", "Claude Code", ""}
	default:
		return row{"claude", "modelo de Claude Code · " + effort, "models.json", ""}
	}
}

func loadState(root, project string) appState {
	var config runtimeConfig
	_ = readJSON(filepath.Join(root, "runtime.json"), &config)
	channel := "dev"
	if marker, err := os.ReadFile(filepath.Join(root, ".n-ein-channel")); err == nil {
		channel = strings.TrimSpace(string(marker))
	}
	if channel != "dev" && channel != "preview" && channel != "stable" {
		channel = "desconocido"
	}
	config, modelSources, modelError := applyModelSelections(config, channel)
	branch := known(command(project, "git", "branch", "--show-current"))
	status := command(project, "git", "status", "--short")
	gitState, changes := "limpio", "limpio"
	if branch == "desconocido" {
		gitState, changes = "desconocido", "sin Git"
	} else if status != "" {
		count := len(strings.Split(status, "\n"))
		gitState, changes = fmt.Sprintf("%d rutas con cambios", count), fmt.Sprintf("%d sin confirmar", count)
	}
	objective, tasks, current, evidence := workState(project)
	piBin, piSource := os.Getenv("N_EIN_PI_BIN"), "N_EIN_PI_BIN"
	if piBin == "" {
		if managed, err := layout.PiBinary(config.Pi.Version); err == nil {
			piBin, piSource = managed, "runtime Pi de n_ein"
		}
	}
	claudeBin, claudeSource := os.Getenv("N_EIN_CLAUDE_BIN"), "N_EIN_CLAUDE_BIN"
	if claudeBin == "" {
		claudeBin, claudeSource = "claude", "claude --version"
	}
	piVersion := known(command(project, piBin, "--version"))
	claudeVersion := known(command(project, claudeBin, "--version"))
	codegraphBin, codegraphSource := os.Getenv("N_EIN_CODEGRAPH_BIN"), "N_EIN_CODEGRAPH_BIN"
	if codegraphBin == "" {
		if managed, err := layout.CodeGraphBinary(config.CodeGraph.Version); err == nil {
			codegraphBin, codegraphSource = managed, "runtime CodeGraph de n_ein"
		}
	}
	codegraphVersion := known(command(project, codegraphBin, "--version"))
	if codegraphVersion != "desconocido" && codegraphVersion != config.CodeGraph.Version {
		codegraphVersion = "requiere " + config.CodeGraph.Version + " · actual " + codegraphVersion
	}
	// El índice vive en la raíz del repositorio; el lanzador lo crea o sincroniza al abrir un agente.
	index := "se creará al abrir Pi o Claude"
	if top := command(project, "git", "rev-parse", "--show-toplevel"); top == "" {
		index = "sin repositorio git"
	} else if _, err := os.Stat(filepath.Join(top, ".codegraph")); err == nil {
		index = "presente · sincroniza al abrir"
	}
	installVersion := "desconocido"
	var install struct {
		Version string `json:"version"`
	}
	if readJSON(filepath.Join(root, "install.json"), &install) {
		installVersion = known(install.Version)
	} else if _, err := os.Stat(filepath.Join(root, "go", "go.mod")); err == nil {
		installVersion = "checkout de desarrollo"
	}
	sessionRows := []row{}
	for _, item := range recentSessions(channel, project) {
		text := []rune(strings.ReplaceAll(item.last, "\n", " "))
		if len(text) > 65 {
			text = append(text[:62], '.', '.', '.')
		}
		action := ""
		if item.id != "" {
			action = "resume-" + strings.ToLower(item.runtime) + ":" + item.id
		}
		sessionRows = append(sessionRows, row{item.runtime + " " + item.when.Format("02/01 15:04"), string(text), "sesión", action})
	}
	if len(sessionRows) == 0 {
		sessionRows = []row{{"recientes", "sin sesiones", "sesiones", ""}}
	}
	doctor := row{"doctor", "sin instalación", "n-ein-install", ""}
	if _, err := os.Stat(filepath.Join(root, "install.json")); err == nil {
		if _, err := os.Stat(filepath.Join(root, "bin", "n-ein-install")); err == nil {
			doctor = row{"doctor", "integridad y runtimes", "n-ein-install", "doctor"}
		}
	}
	piAction, piLabel := "pi", "abrir agente principal"
	if piVersion == "desconocido" {
		piAction, piLabel = "", "no disponible"
	} else if modelError != nil {
		piAction, piLabel = "", "ajustes de modelos inválidos"
	} else if config.Pi.Version == "" {
		piAction, piLabel = "", "versión esperada desconocida"
	} else if piVersion != config.Pi.Version {
		piAction, piLabel = "", "requiere Pi "+config.Pi.Version+" · actual "+piVersion
	}
	claudeAction, claudeLabel := "claude", "abrir relevo aislado"
	if claudeVersion == "desconocido" {
		claudeAction, claudeLabel = "", "no disponible"
	}
	// Una fila por rol: el principal decide; los tres nein-* son delegaciones con su propio modelo.
	roleRow := func(label, key string, choice modelSelection) row {
		if modelError != nil {
			return row{label, modelError.Error(), "models.json", ""}
		}
		return row{label, known(choice.Model) + " · " + known(choice.Thinking), modelSources[key], ""}
	}
	principal := modelSelection{Model: config.Pi.Model, Thinking: config.Pi.Thinking}
	piNote := piLabel
	if piAction != "" {
		piNote = strings.TrimPrefix(known(config.Pi.Model), "openai-codex/") + " · " + known(config.Pi.Thinking)
	}
	claudeNote := ""
	if claudeAction == "" {
		claudeNote = claudeLabel
	}
	sessionNote := "sin sesiones"
	if count := len(sessionRows); sessionRows[0].action != "" && count == 1 {
		sessionNote = "1 reciente"
	} else if sessionRows[0].action != "" {
		sessionNote = fmt.Sprintf("%d recientes", count)
	}
	// Codex aparece para que se vea dónde irá; no se elige hasta que exista su adaptador.
	menu := []menuItem{
		{"Pi", piNote, "p", piAction},
		{"Claude Code", claudeNote, "c", claudeAction},
		{"Codex", "sin adaptador", "", ""},
		{"Elegir una sesión", sessionNote, "s", "view:3"},
		{"Estado del proyecto", tasks, "e", "view:1"},
	}
	homeRows := make([]row, len(menu))
	for i, item := range menu {
		homeRows[i] = row{item.label, item.note, item.key, item.action}
	}
	displayRoot := project
	if home, err := os.UserHomeDir(); err == nil && strings.HasPrefix(project, home+string(filepath.Separator)) {
		displayRoot = "~" + strings.TrimPrefix(project, home)
	}
	return appState{menu: menu, home: homeContext{
		name: filepath.Base(project), branch: branch, changes: changes, root: displayRoot,
		channel: channel, version: installVersion,
	}, views: []panel{
		{0, "INICIO", homeRows},
		{1, "ESTADO", []row{
			{"proyecto", project, "cwd", ""}, {"rama", branch, "Git", ""}, {"cambios", gitState, "Git", ""},
			{"objetivo", objective, "WORK.md", ""}, {"tareas", tasks, "WORK.md", ""}, {"siguiente", current, "WORK.md", ""},
			{"comprobación", evidence, "WORK.md", ""}, {"índice", index, "CodeGraph", ""},
		}},
		{2, "CONFIGURACIÓN", append(append([]row{
			roleRow("principal", "principal", principal),
			roleRow("nein-scout", "scout", config.Scout),
			roleRow("nein-worker", "worker", config.Worker),
			roleRow("nein-reviewer", "reviewer", config.Reviewer),
			claudeRow(config.Claude.Effort, modelError),
			{"editar", "abrir Pi y usar /nein:models", "Pi", piAction},
		}, langRows(channel)...), row{"canal", channel, ".n-ein-channel", ""})},
		{3, "SESIONES", sessionRows},
		{4, "SISTEMA", []row{
			{"paquete", installVersion, "install.json", ""}, {"Pi", piVersion, piSource, ""},
			{"Claude", claudeVersion, claudeSource, ""}, {"CodeGraph", codegraphVersion, codegraphSource, ""}, doctor, {"actualizaciones", "desconocido", "sin remoto", ""},
		}},
	}}
}
