package main

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"unicode/utf8"

	tea "charm.land/bubbletea/v2"
)

type uiModel struct {
	state  appState
	view   int
	row    int
	filter string
	focus  bool
	launch string
}

func (m uiModel) Init() tea.Cmd { return nil }

func (m uiModel) visibleRows() []row {
	rows := m.state.views[m.view].rows
	if m.filter == "" {
		return rows
	}
	var visible []row
	needle := strings.ToLower(m.filter)
	for _, item := range rows {
		if strings.Contains(strings.ToLower(item.label+" "+item.value), needle) {
			visible = append(visible, item)
		}
	}
	return visible
}

func (m uiModel) Update(message tea.Msg) (tea.Model, tea.Cmd) {
	key, ok := message.(tea.KeyPressMsg)
	if !ok {
		return m, nil
	}
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
		m.focus, m.filter, m.row = true, "", 0
	case "enter":
		rows := m.visibleRows()
		if m.row < len(rows) && rows[m.row].action != "" {
			m.launch = rows[m.row].action
			return m, tea.Quit
		}
	}
	return m, nil
}

func (m uiModel) View() tea.View {
	return tea.NewView(render(m.state.views[m.view], m.row, m.filter, m.focus, true, m.state.colors))
}

func ansi(hex string) string {
	if len(hex) != 7 || hex[0] != '#' {
		return ""
	}
	red, err1 := strconv.ParseInt(hex[1:3], 16, 64)
	green, err2 := strconv.ParseInt(hex[3:5], 16, 64)
	blue, err3 := strconv.ParseInt(hex[5:7], 16, 64)
	if err1 != nil || err2 != nil || err3 != nil {
		return ""
	}
	return fmt.Sprintf("\x1b[38;2;%d;%d;%dm", red, green, blue)
}

func render(panel panel, selected int, filter string, searching, color bool, colors palette) string {
	if _, disabled := os.LookupEnv("NO_COLOR"); disabled {
		color = false
	}
	accent, primary, secondary, reset := "", "", "", ""
	if color {
		accent, primary, secondary, reset = ansi(colors.Yellow), ansi(colors.Concrete), ansi(colors.Structure), "\x1b[0m"
	}
	var builder strings.Builder
	fmt.Fprintf(&builder, "%s// %03d  %s%s\n\n", secondary, panel.number, primary, panel.title+reset)
	rows := panel.rows
	if filter != "" {
		var visible []row
		for _, item := range rows {
			if strings.Contains(strings.ToLower(item.label+" "+item.value), strings.ToLower(filter)) {
				visible = append(visible, item)
			}
		}
		rows = visible
	}
	if len(rows) == 0 {
		builder.WriteString("  sin resultados\n")
	}
	for index, item := range rows {
		pointer := " "
		if index == selected {
			pointer = accent + "▸" + reset
		}
		fmt.Fprintf(&builder, "%s %-15s %s%s  %s[%s]%s\n", pointer, item.label, primary, item.value, secondary, item.source, reset)
	}
	if searching {
		fmt.Fprintf(&builder, "\n%sbuscar: %s%s\n", secondary, filter, reset)
	} else if filter != "" {
		fmt.Fprintf(&builder, "\n%sfiltro: %s%s\n", secondary, filter, reset)
	}
	builder.WriteString("\ntab vistas · j/k mover · g/G extremos · f buscar · enter abrir · q salir\n")
	return builder.String()
}
