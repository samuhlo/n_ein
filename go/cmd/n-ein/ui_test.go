package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	tea "charm.land/bubbletea/v2"

	"n_ein/internal/brand"
)

func key(code rune, text string) tea.KeyPressMsg {
	return tea.KeyPressMsg(tea.Key{Code: code, Text: text})
}

func TestKeyboardNavigationAndSearch(t *testing.T) {
	m := uiModel{state: appState{views: []panel{
		{0, "ESTADO", []row{{"uno", "A", "test", ""}, {"dos", "B", "test", ""}}},
		{1, "RUNTIME", []row{{"Pi", "abrir", "test", "pi"}, {"Claude", "abrir", "test", "claude"}}},
	}}}
	updated, _ := m.Update(key('j', "j"))
	m = updated.(uiModel)
	if m.row != 1 {
		t.Fatal("j no mueve la fila")
	}
	updated, _ = m.Update(key('g', "g"))
	m = updated.(uiModel)
	if m.row != 0 {
		t.Fatal("g no va al principio")
	}
	updated, _ = m.Update(key('G', "G"))
	m = updated.(uiModel)
	if m.row != 1 {
		t.Fatal("G no va al final")
	}
	updated, _ = m.Update(key(tea.KeyTab, ""))
	m = updated.(uiModel)
	if m.view != 1 || m.row != 0 {
		t.Fatal("tab no cambia de vista")
	}
	updated, _ = m.Update(key('f', "f"))
	m = updated.(uiModel)
	if !m.focus || !strings.Contains(m.View().Content, "buscar:") {
		t.Fatal("f no abre búsqueda visible")
	}
	updated, _ = m.Update(key('C', "C"))
	m = updated.(uiModel)
	if len(m.visibleRows()) != 1 || m.visibleRows()[0].label != "Claude" {
		t.Fatal("el filtro no selecciona la fila Claude")
	}
	updated, _ = m.Update(key(tea.KeyEnter, ""))
	m = updated.(uiModel)
	updated, _ = m.Update(key(tea.KeyEnter, ""))
	m = updated.(uiModel)
	if m.launch != "claude" {
		t.Fatalf("enter no lanza la fila visible: %s", m.launch)
	}
}

func TestRenderMonochromeAndUnknown(t *testing.T) {
	t.Setenv("NO_COLOR", "1")
	state := appState{views: []panel{{}, {0, "ESTADO", []row{{"verificación", "desconocida", "WORK.md", ""}}}}}
	output := render(state, 1, 0, "", false, brand.Painter{Color: brand.Enabled()}, screen{})
	if strings.Contains(output, "\x1b[") || !strings.Contains(output, "desconocida") || !strings.Contains(output, "// 000") {
		t.Fatal("NO_COLOR o datos desconocidos no respetados")
	}
}

func TestNullDeviceIsNotATerminal(t *testing.T) {
	null, err := os.Open(os.DevNull)
	if err != nil {
		t.Fatal(err)
	}
	defer null.Close()
	if isTerminal(null) {
		t.Fatal("/dev/null no debe abrir la TUI")
	}
}

func homeState() appState {
	menu := []menuItem{
		{"Pi", "gpt-6-sol · high", "p", "pi"},
		{"Claude Code", "", "c", "claude"},
		{"Codex", "sin adaptador", "", ""},
		{"Elegir una sesión", "2 recientes", "s", "view:2"},
	}
	rows := make([]row, len(menu))
	for i, item := range menu {
		rows[i] = row{item.label, item.note, item.key, item.action}
	}
	return appState{menu: menu, home: homeContext{name: "demo", branch: "main", changes: "limpio"}, views: []panel{
		{0, "INICIO", rows}, {1, "ESTADO", nil}, {2, "SESIONES", []row{{"pi 01/10", "hola", "sesión", "resume-pi:x"}}},
	}}
}

func TestHomeOffersRuntimesAndShortcuts(t *testing.T) {
	m := newUIModel(homeState(), homeView, false)
	updated, _ := m.Update(key('c', "c"))
	if got := updated.(uiModel).launch; got != "claude" {
		t.Fatalf("c no lanza Claude: %q", got)
	}
	updated, _ = m.Update(key('s', "s"))
	if got := updated.(uiModel); got.view != 2 || got.launch != "" {
		t.Fatalf("s no abre sesiones sin salir: view %d launch %q", got.view, got.launch)
	}
	m.row = 2
	updated, _ = m.Update(key(tea.KeyEnter, ""))
	if got := updated.(uiModel).launch; got != "" {
		t.Fatalf("Codex sin adaptador no debe lanzar nada: %q", got)
	}
	m.row = 0
	updated, _ = m.Update(key(tea.KeyEnter, ""))
	if got := updated.(uiModel).launch; got != "pi" {
		t.Fatalf("enter en Pi no lo lanza: %q", got)
	}
}

func TestHomeIntroSettlesOnKeyAndPlainOutput(t *testing.T) {
	t.Setenv("NO_COLOR", "1")
	m := newUIModel(homeState(), homeView, true)
	if !m.intro || strings.Contains(m.View().Content, "Claude Code") {
		t.Fatal("la apertura debe empezar sin menú")
	}
	updated, _ := m.Update(key('j', "j"))
	m = updated.(uiModel)
	content := m.View().Content
	if m.intro || !strings.Contains(content, "Claude Code") || !strings.Contains(content, "demo · main · limpio") {
		t.Fatalf("una tecla no asienta la portada:\n%s", content)
	}
	plain := render(homeState(), homeView, 0, "", false, brand.Painter{}, screen{elapsed: brand.IntroSeconds})
	if strings.Contains(plain, "\x1b[") || !strings.Contains(plain, "▸ Pi") || !strings.Contains(plain, "▀▀▀▀▀") {
		t.Fatalf("portada sin TTY ilegible:\n%s", plain)
	}
}

func TestConfigCyclesLanguageWithoutLeavingTUI(t *testing.T) {
	path := filepath.Join(t.TempDir(), "lang.json")
	t.Setenv("N_EIN_LANG_FILE", path)
	rows := langRows("dev")
	if rows[0].value != "español · enter cambia" || rows[1].value != "el del proyecto · enter cambia" || rows[0].source != "por defecto" {
		t.Fatalf("idioma por defecto: %#v", rows)
	}
	state := appState{home: homeContext{channel: "dev"}, views: []panel{{}, {}, {2, "CONFIGURACIÓN", rows}}}
	m := uiModel{state: state, view: 2}
	updated, _ := m.Update(key(tea.KeyEnter, ""))
	m = updated.(uiModel)
	if m.launch != "" || m.state.views[2].rows[0].value != "inglés · enter cambia" || m.state.views[2].rows[0].source != "lang.json" {
		t.Fatalf("enter no cicla la conversación sin salir: %q %#v", m.launch, m.state.views[2].rows[0])
	}
	m.row = 1
	for _, want := range []string{"español", "inglés", "el del proyecto"} {
		updated, _ = m.Update(key(tea.KeyEnter, ""))
		m = updated.(uiModel)
		if m.state.views[2].rows[1].value != want+" · enter cambia" {
			t.Fatalf("artefactos: quería %s, hay %#v", want, m.state.views[2].rows[1])
		}
	}
	if data, err := os.ReadFile(path); err != nil || !strings.Contains(string(data), `"chat": "en"`) {
		t.Fatalf("lang.json no guardado: %s %v", data, err)
	}
	if err := os.WriteFile(path, []byte(`{"chat":"fr","artifacts":"es"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if rows := langRows("dev"); !strings.Contains(rows[0].value, "lang.json inválido") || rows[0].action != "" {
		t.Fatalf("lang.json inválido aceptado: %#v", rows)
	}
}
