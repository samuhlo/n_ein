// Package brand paints n_ein's terminal identity: palette, Panel logo and live flap.
package brand

import (
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"github.com/charmbracelet/x/term"
)

// =============================================================================
// MARCA EN TERMINAL
// La escala de STYLE (Ein) y el logo 004 Panel: un tablero de estación cuyas
// palas giran hasta asentarse en n_ein. El amarillo es solo la pala del `_`.
// =============================================================================

// Los cuatro primeros duplican brand.json; brand_test.go obliga a que coincidan.
const (
	Carbon    = "#0B0B0B"
	Concrete  = "#FAF3F0"
	Yellow    = "#FFCA40"
	Muted     = "#9A9A9A" // gris de cuerpo: claves y metadatos
	Faint     = "#5A5A5A" // rutas, notas, atajos
	Structure = "#3A3A3A" // reglas, números de sección, hecho
	FocusBand = "#1F1A0F" // yellow α 0.08: la banda de foco es cálida
	TileHigh  = "#1A1A1A"
	TileLow   = "#141414"
	TileCard  = "#161616"
)

// IntroSeconds es la apertura completa del Panel; después, la marca es estática.
const IntroSeconds = 2.2

// Painter decide una vez si hay color; NO_COLOR y las salidas sin TTY pintan monocromo.
type Painter struct{ Color bool }

func ForWriter(output io.Writer) Painter {
	file, ok := output.(*os.File)
	return Painter{Color: ok && term.IsTerminal(file.Fd()) && Enabled()}
}

func Enabled() bool {
	_, disabled := os.LookupEnv("NO_COLOR")
	return !disabled && os.Getenv("TERM") != "dumb"
}

func rgb(hex string) (int64, int64, int64) {
	red, _ := strconv.ParseInt(hex[1:3], 16, 64)
	green, _ := strconv.ParseInt(hex[3:5], 16, 64)
	blue, _ := strconv.ParseInt(hex[5:7], 16, 64)
	return red, green, blue
}

func (p Painter) Fg(hex, text string) string {
	if !p.Color || text == "" || len(hex) != 7 {
		return text
	}
	r, g, b := rgb(hex)
	return fmt.Sprintf("\x1b[38;2;%d;%d;%dm%s\x1b[39m", r, g, b, text)
}

func (p Painter) Bg(hex, text string) string {
	if !p.Color || text == "" || len(hex) != 7 {
		return text
	}
	r, g, b := rgb(hex)
	return fmt.Sprintf("\x1b[48;2;%d;%d;%dm%s\x1b[49m", r, g, b, text)
}

func (p Painter) Bold(text string) string {
	if !p.Color || text == "" {
		return text
	}
	return "\x1b[1m" + text + "\x1b[22m"
}

// Heading pinta `// NNN  TÍTULO` según STYLE // 002 regla 4: `//` en acento, número en estructura.
func (p Painter) Heading(number int, title string) string {
	return p.Fg(Yellow, "//") + " " + p.Fg(Structure, fmt.Sprintf("%03d", number)) + "  " + p.Fg(Concrete, title)
}

// Wordmark es la forma de una línea: el `_` es el gesto de marca.
func (p Painter) Wordmark() string {
	return p.Fg(Concrete, "n") + p.Fg(Yellow, "_") + p.Fg(Concrete, "ein")
}

// Letras de 5 × 7 píxeles (la i mide 3); un píxel es una celda de ancho y media de alto.
var font = map[rune][7]string{
	'n': {".....", ".....", "####.", "#...#", "#...#", "#...#", "#...#"},
	'e': {".....", ".....", ".###.", "#...#", "#####", "#....", ".###."},
	'i': {".#.", "...", "##.", ".#.", ".#.", ".#.", "###"},
	'_': {".....", ".....", ".....", ".....", ".....", ".....", "#####"},
	'o': {".....", ".....", ".###.", "#...#", "#...#", "#...#", ".###."},
	'a': {".....", ".....", ".###.", "....#", ".####", "#...#", ".####"},
	's': {".....", ".....", ".####", "#....", ".###.", "....#", "####."},
	't': {".#...", ".#...", "####.", ".#...", ".#...", ".#...", "..##."},
	'r': {".....", ".....", "#.##.", "##..#", "#....", "#....", "#...."},
	'u': {".....", ".....", "#...#", "#...#", "#...#", "#...#", ".####"},
}

var (
	word     = []rune("n_ein")
	flapPool = []rune("aostrunei_")
	alphabet = []rune("abcdefghijklmnopqrstuvwxyz")
)

// hash da el giro pseudoaleatorio de cada pala; determinista para que los tests vean lo mismo.
func hash(x, y, seed int) float64 {
	h := uint32(int32(x)*374761393) ^ uint32(int32(y)*668265263) ^ uint32(int32(seed)*982451653)
	h = (h ^ (h >> 13)) * 1274126177
	h ^= h >> 16
	return float64(h) / 4294967296
}

// flapState dice si la pala k ya apareció, qué letra muestra y si está asentada.
func flapState(k int, t float64, pool []rune) (visible bool, letter rune, settled bool) {
	if t <= 0.1+0.06*float64(k) {
		return false, 0, false
	}
	if t >= 0.55+0.3*float64(k) {
		return true, word[k], true
	}
	return true, pool[int(hash(k, int(t*16), 5)*float64(len(pool)))], false
}

func (p Painter) letterColor(letter rune, settled bool) string {
	switch {
	case !settled:
		return Muted
	case letter == '_':
		return Yellow
	default:
		return Concrete
	}
}

const (
	tileWidth  = 7
	tileHeight = 6
	tileGap    = 1
	// LargeWidth es el ancho del Panel grande en celdas; LargeHeight, su alto.
	LargeWidth  = 5*tileWidth + 4*tileGap
	LargeHeight = tileHeight
	// SmallWidth es el ancho de la marca pequeña del instalador.
	SmallWidth = 19
)

// Large devuelve las seis filas del Panel en el instante t (segundos desde la apertura).
// Cada celda combina dos píxeles verticales con medios bloques sobre el fondo de la pala.
func (p Painter) Large(t float64) []string {
	type cell struct {
		top, bottom bool
		bg, fg      string
		tile        bool
	}
	grid := make([][]cell, LargeHeight)
	for y := range grid {
		grid[y] = make([]cell, LargeWidth)
	}
	for k := range word {
		visible, letter, settled := flapState(k, t, flapPool)
		if !visible {
			continue
		}
		left := k * (tileWidth + tileGap)
		for y := 0; y < tileHeight; y++ {
			bg := TileHigh
			if y >= tileHeight/2 {
				bg = TileLow
			}
			for x := 0; x < tileWidth; x++ {
				grid[y][left+x] = cell{bg: bg, tile: true}
			}
		}
		glyph := font[letter]
		offset := left + (tileWidth-len(glyph[0]))/2
		color := p.letterColor(letter, settled)
		for gy, line := range glyph {
			for gx, pixel := range line {
				if pixel != '#' {
					continue
				}
				// La letra empieza dos píxeles por debajo del borde: queda centrada en la pala.
				py := gy + 2
				target := &grid[py/2][offset+gx]
				target.fg = color
				if py%2 == 0 {
					target.top = true
				} else {
					target.bottom = true
				}
			}
		}
	}
	lines := make([]string, LargeHeight)
	for y, row := range grid {
		var builder strings.Builder
		for _, c := range row {
			glyph := " "
			switch {
			case c.top && c.bottom:
				glyph = "█"
			case c.top:
				glyph = "▀"
			case c.bottom:
				glyph = "▄"
			}
			if !p.Color {
				builder.WriteString(glyph)
				continue
			}
			if c.tile {
				builder.WriteString(p.Bg(c.bg, p.Fg(c.fg, glyph)))
			} else {
				builder.WriteString(glyph)
			}
		}
		lines[y] = strings.TrimRight(builder.String(), " ")
	}
	return lines
}

// Small devuelve las tres filas de la marca pequeña: palas de 3 × 3 con la letra en texto.
func (p Painter) Small(t float64) []string {
	lines := make([]string, 3)
	for k := range word {
		visible, letter, settled := flapState(k, t, alphabet)
		for y := 0; y < 3; y++ {
			if k > 0 {
				lines[y] += " "
			}
			if !visible {
				lines[y] += "   "
				continue
			}
			bg := TileCard
			switch y {
			case 0:
				bg = TileHigh
			case 2:
				bg = TileLow
			}
			middle := "   "
			if y == 1 {
				middle = " " + p.Fg(p.letterColor(letter, settled), string(letter)) + " "
			}
			if !p.Color && y != 1 {
				lines[y] += "   "
				continue
			}
			lines[y] += p.Bg(bg, middle)
		}
	}
	for y := range lines {
		lines[y] = strings.TrimRight(lines[y], " ")
	}
	return lines
}

// Flap es el indicador de trabajo: una pala que sigue girando.
func (p Painter) Flap(seconds float64) string {
	letter := string(alphabet[int(seconds*12)%len(alphabet)])
	if !p.Color {
		return letter
	}
	return p.Bg(TileCard, p.Fg(Yellow, letter))
}
