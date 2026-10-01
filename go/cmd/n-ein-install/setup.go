package main

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"n_ein/internal/brand"
	"n_ein/internal/layout"
)

// =============================================================================
// SETUP — Pi, código, entrada y doctor en un solo recorrido
// La superficie del instalador del diseño 004 Panel: marca pequeña, `// 000`
// y un paso por línea. APPEND-ONLY, como el progreso de Ein: el paso en curso
// vive en su propia línea y se reescribe con `\r`; nunca se sube el cursor
// sobre lo que ya se escribió. Sin TTY, cada paso es una línea plana.
// =============================================================================

type setupStep struct {
	label string
	// run hace el paso y devuelve el detalle visible; el informe del verbo queda en report.
	run func(report io.Writer) (string, error)
}

type setupView struct {
	output  io.Writer
	painter brand.Painter
	live    bool
	plan    bool
	total   int
}

func (v setupView) intro(lines func(float64) []string, side [3]string) {
	clear := ""
	if v.live {
		clear = "\x1b[2K"
	}
	frame := func(t float64) {
		for i, line := range lines(t) {
			fmt.Fprintf(v.output, "%s  %s%s%s\n", clear, line, strings.Repeat(" ", brand.SmallWidth-visible(line)+4), side[i])
		}
	}
	if !v.live {
		frame(brand.IntroSeconds)
		return
	}
	// La apertura es única y corta; después la marca queda estática (STYLE: sin bucles).
	start := time.Now()
	for t := 0.0; t < brand.IntroSeconds; t = time.Since(start).Seconds() {
		frame(t)
		fmt.Fprint(v.output, "\x1b[3A")
		time.Sleep(40 * time.Millisecond)
	}
	frame(brand.IntroSeconds)
}

// visible cuenta celdas sin las secuencias ANSI; la marca pequeña solo usa glifos de una celda.
func visible(text string) int {
	count, escape := 0, false
	for _, r := range text {
		switch {
		case r == '\x1b':
			escape = true
		case escape:
			if r >= '@' && r <= '~' && r != '[' {
				escape = false
			}
		default:
			count++
		}
	}
	return count
}

func (v setupView) line(mark, label string, index int, detail string, labelColor, detailColor string) string {
	p := v.painter
	counter := fmt.Sprintf("%d/%d", index+1, v.total)
	return fmt.Sprintf("  %s %s %s  %s", mark, p.Fg(labelColor, fmt.Sprintf("%-10s", label)), p.Fg(brand.Structure, counter), p.Fg(detailColor, detail))
}

func (v setupView) step(index int, item setupStep) (string, error) {
	p := v.painter
	var report bytes.Buffer
	var stop chan struct{}
	var done sync.WaitGroup
	if v.live {
		// El indicador vivo es una pala girando, siempre en la línea del paso.
		stop = make(chan struct{})
		done.Add(1)
		go func() {
			defer done.Done()
			start := time.Now()
			ticker := time.NewTicker(80 * time.Millisecond)
			defer ticker.Stop()
			for {
				fmt.Fprintf(v.output, "\r\x1b[2K%s", v.line(p.Flap(time.Since(start).Seconds()), item.label, index, "", brand.Concrete, brand.Muted))
				select {
				case <-stop:
					return
				case <-ticker.C:
				}
			}
		}()
	}
	detail, err := item.run(&report)
	if v.live {
		close(stop)
		done.Wait()
		fmt.Fprint(v.output, "\r\x1b[2K")
	}
	if err != nil {
		fmt.Fprintln(v.output, v.line(p.Fg(brand.Concrete, "✗"), item.label, index, err.Error(), brand.Concrete, brand.Muted))
		return report.String(), err
	}
	// En el plan nada está hecho: `·` es pendiente y `✓` queda para lo ejecutado.
	mark := "✓"
	if v.plan {
		mark = "·"
	}
	fmt.Fprintln(v.output, v.line(p.Fg(brand.Structure, mark), item.label, index, detail, brand.Muted, brand.Faint))
	return report.String(), nil
}

func tildePath(path string) string {
	if home, err := os.UserHomeDir(); err == nil && strings.HasPrefix(path, home+string(filepath.Separator)) {
		return "~" + strings.TrimPrefix(path, home)
	}
	return path
}

// [FLOW] Recorrido completo desde un paquete: Pi gestionado → código → enlace nein → doctor.
func setup(source, channel, self string, dryRun bool, output io.Writer) error {
	artifact, err := validateArtifact(source)
	if err != nil {
		return fmt.Errorf("setup requiere un paquete válido: %w", err)
	}
	root, err := layout.Root()
	if err != nil {
		return err
	}
	target, err := layout.Installation(channel)
	if err != nil {
		return err
	}
	if err := protectTarget(target); err != nil {
		return err
	}
	if err := separate(source, target); err != nil {
		return err
	}
	version, err := piVersionFrom(source)
	if err != nil {
		return err
	}
	_, statErr := os.Stat(target)
	existing := statErr == nil
	unchanged := false
	if existing {
		current, readErr := os.ReadFile(filepath.Join(target, "package-manifest.json"))
		candidate, candidateErr := os.ReadFile(filepath.Join(source, "package-manifest.json"))
		unchanged = readErr == nil && candidateErr == nil && bytes.Equal(current, candidate)
	}

	steps := []setupStep{
		{"pi", func(report io.Writer) (string, error) {
			if err := installPiRuntime(source, dryRun, report); err != nil {
				return "", err
			}
			switch text := report.(*bytes.Buffer).String(); {
			case strings.Contains(text, "ya instalado"):
				return version + " · ya instalado", nil
			case dryRun:
				return version + " · se instalará en runtimes/pi", nil
			default:
				return version + " · instalado en runtimes/pi", nil
			}
		}},
		{"codegraph", func(report io.Writer) (string, error) {
			pin, err := codeGraphFrom(source)
			if err != nil {
				return "", err
			}
			if err := installCodeGraphRuntime(source, dryRun, report); err != nil {
				return "", err
			}
			switch text := report.(*bytes.Buffer).String(); {
			case strings.Contains(text, "ya instalado"):
				return pin.Version + " · ya instalado", nil
			case dryRun:
				return pin.Version + " · se descargará y verificará", nil
			default:
				return pin.Version + " · verificado en runtimes/codegraph", nil
			}
		}},
		{"código", func(report io.Writer) (string, error) {
			if unchanged {
				return artifact.Version + " · ya instalado", nil
			}
			if err := install(source, target, channel, self, existing, dryRun, report); err != nil {
				return "", err
			}
			detail := artifact.Version + " · " + channel
			if existing {
				detail += " · backup del anterior"
			}
			if dryRun {
				detail += " · plan"
			}
			return detail, nil
		}},
		{"entrada", func(report io.Writer) (string, error) {
			// Una instalación anterior sin bin/nein solo puede activarse después del update.
			if dryRun && !executable(filepath.Join(target, "bin", "nein")) {
				return "nein se activará tras instalar", nil
			}
			if err := activateLauncher(target, channel, dryRun, report); err != nil {
				return "", err
			}
			return tildePath(filepath.Join(linkDirectory(root), "nein")), nil
		}},
		{"doctor", func(report io.Writer) (string, error) {
			if dryRun {
				return "se ejecutará al terminar", nil
			}
			meta, err := validate(target)
			if err != nil {
				return "", err
			}
			if err := checkRuntime(target, report); err != nil {
				return "", err
			}
			return fmt.Sprintf("%d archivos · Pi %s · CodeGraph · Bun", len(meta.Files), version), nil
		}},
	}

	p := brand.ForWriter(output)
	view := setupView{output: output, painter: p, live: p.Color, plan: dryRun, total: len(steps)}
	fmt.Fprintln(output)
	view.intro(p.Small, [3]string{
		"",
		p.Fg(brand.Muted, "instalador · "+channel+" · "+artifact.Version),
		p.Fg(brand.Faint, "hogar "+tildePath(root)),
	})
	title := "INSTALAR"
	if dryRun {
		title = "PLAN"
	}
	fmt.Fprintf(output, "\n  %s\n\n", p.Heading(0, title))
	for index, item := range steps {
		if report, err := view.step(index, item); err != nil {
			if trimmed := strings.TrimSpace(report); trimmed != "" {
				fmt.Fprintf(output, "\n%s\n", p.Fg(brand.Faint, trimmed))
			}
			return err
		}
	}
	if dryRun {
		fmt.Fprintf(output, "\n  %s\n", p.Fg(brand.Faint, "--dry-run enseña el plan sin tocar nada"))
		return nil
	}
	fmt.Fprintf(output, "\n  %s %s %s\n", p.Fg(brand.Concrete, "listo."), p.Fg(brand.Muted, "abre el launcher con"), p.Fg(brand.Concrete, "nein"))
	return nil
}

// say escribe una línea `// NNN TÍTULO · detalle`; en terminal lleva los colores de STYLE.
func say(output io.Writer, format string, args ...any) {
	text := strings.TrimSuffix(fmt.Sprintf(format, args...), "\n")
	p := brand.ForWriter(output)
	if !p.Color || !strings.HasPrefix(text, "// ") || len(text) < 7 {
		fmt.Fprintln(output, text)
		return
	}
	head, detail, _ := strings.Cut(text[7:], " · ")
	line := p.Fg(brand.Yellow, "//") + " " + p.Fg(brand.Structure, text[3:6]) + " " + p.Fg(brand.Concrete, head)
	if detail != "" {
		line += p.Fg(brand.Muted, " · "+detail)
	}
	fmt.Fprintln(output, line)
}

func executable(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.Mode().IsRegular() && info.Mode().Perm()&0o111 != 0
}
