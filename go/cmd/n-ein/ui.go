package main

import (
	"fmt"
	"image/color"
	"strings"
	"time"
	"unicode/utf8"

	tea "charm.land/bubbletea/v2"

	"n_ein/internal/brand"
)

// =============================================================================
// LAUNCHER — portada 004 Panel y vistas con la gramática de Ein
// La portada abre con la marca y lo que se viene a hacer (Pi, Claude, sesiones);
// las demás vistas llevan cabecera y `// NNN  TÍTULO`. Sin recuadros: el aire
// separa y el foco es una banda cálida con `▸`. Funciones puras: entra el
// estado, sale texto, y por eso se testea sin terminal.
// =============================================================================

const (
	homeView     = 0
	defaultWidth = 64
	// La marca cede por alto: una portada que no deja ver el menú no es portada.
	brandMinHeight = 22
	labelWidth     = 20
	noteWidth      = 18
)

type introTick time.Time

type uiModel struct {
	state   appState
	view    int
	row     int
	filter  string
	focus   bool
	launch  string
	width   int
	height  int
	started time.Time
	now     time.Time
	intro   bool
}

func newUIModel(state appState, view int, intro bool) uiModel {
	now := time.Now()
	return uiModel{state: state, view: view, started: now, now: now, intro: intro && view == homeView}
}

func tick() tea.Cmd {
	return tea.Tick(40*time.Millisecond, func(at time.Time) tea.Msg { return introTick(at) })
}

func (m uiModel) Init() tea.Cmd {
	if m.intro {
		return tick()
	}
	return nil
}

func (m uiModel) visibleRows() []row {
	return filterRows(m.state.views[m.view].rows, m.filter)
}

func filterRows(rows []row, filter string) []row {
	if filter == "" {
		return rows
	}
	var visible []row
	needle := strings.ToLower(filter)
	for _, item := range rows {
		if strings.Contains(strings.ToLower(item.label+" "+item.value), needle) {
			visible = append(visible, item)
		}
	}
	return visible
}

// choose resuelve una fila: cambiar de vista se queda en la TUI; lanzar algo la cierra.
func (m uiModel) choose(action string) (uiModel, tea.Cmd) {
	if action == "" {
		return m, nil
	}
	var target int
	if _, err := fmt.Sscanf(action, "view:%d", &target); err == nil && target >= 0 && target < len(m.state.views) {
		m.view, m.row, m.filter, m.intro = target, 0, "", false
		return m, nil
	}
	m.launch = action
	return m, tea.Quit
}

func (m uiModel) Update(message tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := message.(type) {
	case tea.WindowSizeMsg:
		m.width, m.height = msg.Width, msg.Height
		return m, nil
	case introTick:
		m.now = time.Time(msg)
		if !m.intro {
			return m, nil
		}
		if m.now.Sub(m.started).Seconds() >= brand.IntroSeconds {
			m.intro = false
			return m, nil
		}
		return m, tick()
	}
	key, ok := message.(tea.KeyPressMsg)
	if !ok {
		return m, nil
	}
	// Cualquier tecla asienta el Panel: la apertura nunca hace esperar.
	m.intro = false
	value := key.String()
	if m.focus {
		switch value {
		case "esc":
			m.filter, m.focus, m.row = "", false, 0
		case "enter":
			m.focus, m.row = false, 0
		case "backspace":
			if len(m.filter) > 0 {
				runes := []rune(m.filter)
				m.filter = string(runes[:len(runes)-1])
			}
		default:
			if utf8.RuneCountInString(value) == 1 {
				m.filter += value
			}
		}
		return m, nil
	}
	if m.view == homeView {
		for _, item := range m.state.menu {
			if item.key != "" && value == item.key {
				return m.choose(item.action)
			}
		}
	}
	switch value {
	case "q", "esc", "ctrl+c":
		return m, tea.Quit
	case "tab":
		m.view, m.row, m.filter = (m.view+1)%len(m.state.views), 0, ""
	case "shift+tab":
		m.view, m.row, m.filter = (m.view+len(m.state.views)-1)%len(m.state.views), 0, ""
	case "j", "down":
		if m.row+1 < len(m.visibleRows()) {
			m.row++
		}
	case "k", "up":
		if m.row > 0 {
			m.row--
		}
	case "g":
		m.row = 0
	case "G", "shift+g":
		if count := len(m.visibleRows()); count > 0 {
			m.row = count - 1
		}
	case "f", "/":
		if m.view != homeView {
			m.focus, m.filter, m.row = true, "", 0
		}
	case "enter":
		rows := m.visibleRows()
		if m.row < len(rows) {
			return m.choose(rows[m.row].action)
		}
	}
	return m, nil
}

func (m uiModel) View() tea.View {
	painter := brand.Painter{Color: brand.Enabled()}
	elapsed := brand.IntroSeconds
	if m.intro {
		elapsed = m.now.Sub(m.started).Seconds()
	}
	frame := screen{width: m.width, height: m.height, elapsed: elapsed}
	view := tea.NewView(render(m.state, m.view, m.row, m.filter, m.focus, painter, frame))
	view.AltScreen = true
	if painter.Color {
		view.BackgroundColor = color.RGBA{R: 0x0B, G: 0x0B, B: 0x0B, A: 0xFF}
	}
	return view
}

// screen es lo que la pintura necesita del terminal; ancho 0 significa salida sin TTY.
type screen struct {
	width   int
	height  int
	elapsed float64
}

func (s screen) total() int {
	if s.width <= 0 {
		return defaultWidth
	}
	// Con tope: en pantallas muy anchas la línea no se estira sin fin.
	return max(40, min(s.width-2, 96))
}

func visibleWidth(text string) int {
	width, escape := 0, false
	for _, r := range text {
		switch {
		case r == '\x1b':
			escape = true
		case escape:
			if r >= '@' && r <= '~' && r != '[' {
				escape = false
			}
		default:
			width++
		}
	}
	return width
}

func clip(text string, room int) string {
	if room <= 0 {
		return ""
	}
	runes := []rune(text)
	if len(runes) <= room {
		return text
	}
	if room == 1 {
		return "…"
	}
	return string(runes[:room-1]) + "…"
}

func center(text string, total int) string {
	return strings.Repeat(" ", max(0, (total-visibleWidth(text))/2)) + text
}

func render(state appState, view, selected int, filter string, searching bool, p brand.Painter, s screen) string {
	if view == homeView {
		return renderHome(state, selected, p, s)
	}
	return renderPanel(state, state.views[view], selected, filter, searching, p, s)
}

func renderHome(state appState, selected int, p brand.Painter, s screen) string {
	total := s.total()
	var b strings.Builder
	b.WriteString("\n")
	if s.height == 0 || s.height >= brandMinHeight {
		for _, line := range p.Large(s.elapsed) {
			if line != "" {
				line = strings.Repeat(" ", (total-brand.LargeWidth)/2) + line
			}
			b.WriteString(line + "\n")
		}
		b.WriteString("\n")
	} else {
		b.WriteString(center(p.Wordmark(), total) + "\n\n")
	}
	// Lema y contexto entran cuando el Panel ya se asentó, como en la apertura del diseño.
	settled := s.elapsed >= brand.IntroSeconds
	if settled {
		b.WriteString(center(p.Fg(brand.Faint, "no hace falta tanto"), total) + "\n")
		home := state.home
		context := strings.Join([]string{home.name, home.branch, home.changes}, " · ")
		b.WriteString(center(p.Fg(brand.Muted, clip(context, total-4)), total) + "\n\n")
	} else {
		b.WriteString("\n\n\n")
	}
	indent := strings.Repeat(" ", max(2, (total-brand.LargeWidth)/2))
	for index, item := range state.menu {
		if !settled {
			b.WriteString("\n")
			continue
		}
		focus := index == selected
		label := fmt.Sprintf("%-*s", labelWidth, clip(item.label, labelWidth-1))
		note := fmt.Sprintf("%-*s", noteWidth, clip(item.note, noteWidth-1))
		keyText := fmt.Sprintf("%-1s", item.key)
		pointer, labelColor := " ", brand.Muted
		if item.action == "" {
			labelColor = brand.Faint
		}
		if focus {
			pointer, labelColor = p.Fg(brand.Yellow, "▸"), brand.Concrete
			label = p.Bold(p.Fg(labelColor, label))
		} else {
			label = p.Fg(labelColor, label)
		}
		line := pointer + " " + label + p.Fg(brand.Faint, note) + p.Fg(brand.Faint, keyText)
		if focus {
			line = p.Bg(brand.FocusBand, line)
		}
		b.WriteString(indent + line + "\n")
	}
	b.WriteString("\n")
	b.WriteString(center(p.Fg(brand.Faint, "tab vistas · j/k mover · enter abrir · q salir"), total) + "\n")
	return b.String()
}

func header(state appState, title string, p brand.Painter, total int) string {
	left := "  " + p.Wordmark() + "   " + p.Fg(brand.Muted, strings.ToLower(title))
	right := clip(strings.Join([]string{state.home.name, state.home.branch, state.home.channel}, " · "), max(0, total-visibleWidth(left)-4))
	gap := max(1, total-visibleWidth(left)-visibleWidth(right)-2)
	return left + strings.Repeat(" ", gap) + p.Fg(brand.Faint, right)
}

func renderPanel(state appState, panel panel, selected int, filter string, searching bool, p brand.Painter, s screen) string {
	total := s.total()
	var b strings.Builder
	b.WriteString(header(state, panel.title, p, total) + "\n\n")
	b.WriteString("  " + p.Heading(panel.number, panel.title) + "\n\n")
	rows := filterRows(panel.rows, filter)
	if len(rows) == 0 {
		b.WriteString("  " + p.Fg(brand.Faint, "sin resultados") + "\n")
	}
	for index, item := range rows {
		focus := index == selected
		source := "[" + item.source + "]"
		room := max(8, total-4-16-len([]rune(source))-2)
		value := clip(item.value, room)
		label := fmt.Sprintf("%-15s", clip(item.label, 15))
		pointer, labelText := " ", p.Fg(brand.Muted, label)
		if focus {
			pointer, labelText = p.Fg(brand.Yellow, "▸"), p.Bold(p.Fg(brand.Concrete, label))
		}
		line := pointer + " " + labelText + " " + p.Fg(brand.Concrete, value) + "  " + p.Fg(brand.Faint, source)
		if focus && p.Color {
			line += strings.Repeat(" ", max(0, total-2-visibleWidth(line)))
			line = p.Bg(brand.FocusBand, line)
		}
		b.WriteString("  " + line + "\n")
	}
	if searching {
		fmt.Fprintf(&b, "\n  %s\n", p.Fg(brand.Muted, "buscar: "+filter))
	} else if filter != "" {
		fmt.Fprintf(&b, "\n  %s\n", p.Fg(brand.Muted, "filtro: "+filter))
	}
	b.WriteString("\n  " + p.Fg(brand.Faint, "tab vistas · j/k mover · g/G extremos · f buscar · enter abrir · q salir") + "\n")
	return b.String()
}
