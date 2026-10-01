package brand

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPaletteMatchesBrandJSON(t *testing.T) {
	data, err := os.ReadFile(filepath.Join("..", "..", "..", "brand.json"))
	if err != nil {
		t.Fatal(err)
	}
	var brand struct {
		Colors map[string]string `json:"colors"`
	}
	if err := json.Unmarshal(data, &brand); err != nil {
		t.Fatal(err)
	}
	for name, value := range map[string]string{"carbon": Carbon, "concrete": Concrete, "yellow": Yellow} {
		if !strings.EqualFold(brand.Colors[name], value) {
			t.Fatalf("%s: brand.json %s, Go %s", name, brand.Colors[name], value)
		}
	}
}

func TestPanelSettlesOnWordmark(t *testing.T) {
	mono := Painter{}
	final := mono.Large(IntroSeconds)
	if len(final) != LargeHeight {
		t.Fatalf("alto del Panel: %d", len(final))
	}
	for _, line := range final {
		if len([]rune(line)) > LargeWidth {
			t.Fatalf("Panel más ancho que %d: %q", LargeWidth, line)
		}
	}
	// El guion bajo es la fila inferior de la segunda pala: siempre la misma tras asentarse.
	if !strings.Contains(strings.Join(final, "\n"), "▀▀▀▀▀") {
		t.Fatalf("el Panel asentado no dibuja el guion bajo:\n%s", strings.Join(final, "\n"))
	}
	// El mismo fotograma lo comprueba el Panel de TypeScript (tests/brand.ts): es el contrato entre lenguajes.
	fixture, err := os.ReadFile(filepath.Join("..", "..", "..", "tests", "fixtures", "panel-final.txt"))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(final, "\n")+"\n" != string(fixture) {
		t.Fatalf("el Panel de Go no coincide con tests/fixtures/panel-final.txt")
	}
	if strings.Join(mono.Large(0), "") != "" {
		t.Fatal("en t=0 no debería haber palas")
	}
	small := mono.Small(IntroSeconds)
	if strings.TrimSpace(small[1]) != "n   _   e   i   n" {
		t.Fatalf("marca pequeña: %q", small[1])
	}
}

func TestColorOnlyWhenPainterAllows(t *testing.T) {
	if strings.Contains(strings.Join(Painter{}.Large(IntroSeconds), ""), "\x1b[") {
		t.Fatal("el monocromo emite ANSI")
	}
	colored := Painter{Color: true}
	if !strings.Contains(colored.Fg(Yellow, "_"), "38;2;255;202;64") {
		t.Fatal("acento sin color de brand")
	}
	if !strings.Contains(strings.Join(colored.Large(IntroSeconds), ""), "48;2;26;26;26") {
		t.Fatal("las palas no pintan su fondo")
	}
}
