// Package main presents n_ein's project and runtime state outside the agent.
package main

import (
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	tea "charm.land/bubbletea/v2"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "[ERR] :: LAUNCH_FAIL :: reason: "+err.Error())
		os.Exit(1)
	}
}

func run(args []string) error {
	flags := flag.NewFlagSet("n-ein", flag.ContinueOnError)
	project := flags.String("project", ".", "proyecto que mostrar")
	root := flags.String("root", "", "raíz del paquete (desarrollo)")
	viewName := flags.String("view", "estado", "estado, configuracion, sesiones, sistema o runtime")
	once := flags.Bool("once", false, "pintar una vez y salir")
	_ = flags.Bool("no-intro", false, "omitir la introducción")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if flags.NArg() != 0 {
		return fmt.Errorf("argumentos inesperados: %v", flags.Args())
	}
	absProject, err := filepath.Abs(*project)
	if err != nil {
		return err
	}
	info, err := os.Stat(absProject)
	if err != nil || !info.IsDir() {
		return fmt.Errorf("proyecto no disponible: %s", absProject)
	}
	packageRoot, err := findPackageRoot(*root)
	if err != nil {
		return err
	}
	state := loadState(packageRoot, absProject)
	view := viewIndex(*viewName)
	if view < 0 {
		return fmt.Errorf("vista desconocida: %s", *viewName)
	}
	interactive := isTerminal(os.Stdin) && isTerminal(os.Stdout) && os.Getenv("TERM") != "dumb"
	if *once || !interactive {
		fmt.Fprint(os.Stdout, render(state.views[view], 0, "", false, false, state.colors))
		if !interactive {
			fmt.Fprintln(os.Stdout, "\n[terminal] vista única · sin TTY")
		}
		return nil
	}
	final, err := tea.NewProgram(uiModel{state: state, view: view}).Run()
	if err != nil {
		// Un fallo de pintura no impide abrir Pi o Claude desde sus lanzadores.
		return fmt.Errorf("interfaz: %w; usa bin/n-ein-dev o bin/n-ein-claude-dev", err)
	}
	selected := final.(uiModel)
	if selected.launch == "" {
		return nil
	}
	if selected.launch == "doctor" {
		cmd := exec.Command(filepath.Join(packageRoot, "bin", "n-ein-install"), "doctor", "--target", packageRoot)
		cmd.Dir = absProject
		cmd.Stdin, cmd.Stdout, cmd.Stderr = os.Stdin, os.Stdout, os.Stderr
		return cmd.Run()
	}
	runtimeName := selected.launch
	launchArgs := []string{}
	if strings.HasPrefix(runtimeName, "resume-") {
		parts := strings.SplitN(strings.TrimPrefix(runtimeName, "resume-"), ":", 2)
		if len(parts) != 2 {
			return fmt.Errorf("sesión inválida")
		}
		runtimeName = parts[0]
		if runtimeName == "pi" {
			launchArgs = []string{"--session", parts[1]}
		} else {
			launchArgs = []string{"--resume", parts[1]}
		}
	}
	launcher := filepath.Join(packageRoot, "bin", "n-ein-"+runtimeName+"-dev")
	if runtimeName == "pi" {
		launcher = filepath.Join(packageRoot, "bin", "n-ein-dev")
	}
	cmd := exec.Command(launcher, launchArgs...)
	cmd.Dir = absProject
	cmd.Stdin, cmd.Stdout, cmd.Stderr = os.Stdin, os.Stdout, os.Stderr
	return cmd.Run()
}

func findPackageRoot(explicit string) (string, error) {
	if explicit != "" {
		return filepath.Abs(explicit)
	}
	if env := os.Getenv("N_EIN_ROOT"); env != "" {
		return filepath.Abs(env)
	}
	self, err := os.Executable()
	if err != nil {
		return "", err
	}
	root := filepath.Dir(filepath.Dir(self))
	if _, err := os.Stat(filepath.Join(root, "runtime.json")); err == nil {
		return root, nil
	}
	return "", fmt.Errorf("runtime.json no encontrado junto al launcher; usa --root")
}

func viewIndex(name string) int {
	names := []string{"estado", "configuracion", "sesiones", "sistema", "runtime"}
	for index, candidate := range names {
		if strings.EqualFold(name, candidate) {
			return index
		}
	}
	return -1
}

func isTerminal(file *os.File) bool {
	info, err := file.Stat()
	return err == nil && info.Mode()&os.ModeCharDevice != 0
}
