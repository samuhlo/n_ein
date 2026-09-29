package main

import (
	"strings"
	"testing"

	tea "charm.land/bubbletea/v2"
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
	panel := panel{0, "ESTADO", []row{{"verificación", "desconocida", "WORK.md", ""}}}
	output := render(panel, 0, "", false, true, palette{Yellow: "#FFCA40", Concrete: "#FAF3F0"})
	if strings.Contains(output, "\x1b[") || !strings.Contains(output, "desconocida") || !strings.Contains(output, "// 000") {
		t.Fatal("NO_COLOR o datos desconocidos no respetados")
	}
}
