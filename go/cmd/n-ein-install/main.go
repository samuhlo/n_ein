// Package main provides the repair path for local n_ein installations.
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"n_ein/internal/layout"
)

func main() {
	self, err := os.Executable()
	if err != nil {
		fmt.Fprintln(os.Stderr, "[ERR] :: SELF_PATH :: reason: "+err.Error())
		os.Exit(1)
	}
	if err := run(os.Args[1:], os.Stdout, self); err != nil {
		fmt.Fprintln(os.Stderr, "[ERR] :: INSTALL_FAIL :: reason: "+err.Error())
		os.Exit(1)
	}
}

func run(args []string, output io.Writer, self string) error {
	if len(args) == 0 {
		return fmt.Errorf("uso: n-ein-install <setup|package|runtime|install|update|doctor|activate|restore|uninstall> [flags]")
	}
	verb := args[0]
	if verb != "setup" && verb != "package" && verb != "runtime" && verb != "install" && verb != "update" && verb != "doctor" && verb != "activate" && verb != "restore" && verb != "uninstall" {
		return fmt.Errorf("verbo desconocido: %s", verb)
	}

	flags := flag.NewFlagSet(verb, flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	source := flags.String("source", ".", "directorio fuente de n_ein")
	artifactPath := flags.String("output", "", "salida inmutable del paquete local")
	target := flags.String("target", "", "directorio de código instalado")
	channel := flags.String("channel", "preview", "preview o stable")
	dryRun := flags.Bool("dry-run", false, "mostrar sin mutar")
	runtime := flags.Bool("runtime", false, "comprobar Bun, Pi y CodeGraph (doctor)")
	if err := flags.Parse(args[1:]); err != nil {
		return err
	}
	if flags.NArg() != 0 {
		return fmt.Errorf("argumentos inesperados: %v", flags.Args())
	}
	if *channel != "preview" && *channel != "stable" {
		return fmt.Errorf("canal inválido: %s", *channel)
	}
	if *runtime && verb != "doctor" {
		return fmt.Errorf("--runtime solo se usa con doctor")
	}
	if verb == "package" {
		if *artifactPath == "" {
			return fmt.Errorf("package requiere --output")
		}
		absSource, err := filepath.Abs(*source)
		if err != nil {
			return err
		}
		absOutput, err := filepath.Abs(*artifactPath)
		if err != nil {
			return err
		}
		return packageArtifact(absSource, absOutput, self, *dryRun, output)
	}
	if verb == "setup" {
		absSource, err := filepath.Abs(*source)
		if err != nil {
			return err
		}
		return setup(absSource, *channel, self, *dryRun, output)
	}
	if verb == "runtime" {
		absSource, err := filepath.Abs(*source)
		if err != nil {
			return err
		}
		if err := installPiRuntime(absSource, *dryRun, output); err != nil {
			return err
		}
		return installCodeGraphRuntime(absSource, *dryRun, output)
	}
	if *target == "" {
		managed, err := layout.Installation(*channel)
		if err != nil {
			return err
		}
		*target = managed
	}
	absTarget, err := filepath.Abs(*target)
	if err != nil {
		return err
	}
	if err := protectTarget(absTarget); err != nil {
		return err
	}

	switch verb {
	case "install", "update":
		absSource, err := filepath.Abs(*source)
		if err != nil {
			return err
		}
		if err := separate(absSource, absTarget); err != nil {
			return err
		}
		return install(absSource, absTarget, *channel, self, verb == "update", *dryRun, output)
	case "doctor":
		manifest, err := validate(absTarget)
		if err != nil {
			return err
		}
		say(output, "// 000 ESTADO · %s · %s · %d archivos verificados\n", manifest.Channel, manifest.Version, len(manifest.Files))
		if *runtime {
			return checkRuntime(absTarget, output)
		}
		return nil
	case "activate":
		return activateLauncher(absTarget, *channel, *dryRun, output)
	case "restore":
		return restore(absTarget, *dryRun, output)
	default:
		return uninstall(absTarget, *dryRun, output)
	}
}

func separate(source, target string) error {
	actualSource, err := resolvedPath(source)
	if err != nil {
		return err
	}
	actualTarget, err := resolvedPath(target)
	if err != nil {
		return err
	}
	if inside(actualSource, actualTarget) || inside(actualTarget, actualSource) {
		return fmt.Errorf("fuente y destino no pueden solaparse")
	}
	return nil
}

// [FLOW] Diagnóstico opcional: la integridad del paquete no depende de tener Pi instalado.
func checkRuntime(root string, output io.Writer) error {
	var config struct {
		Schema int `json:"schema"`
		Pi     struct {
			Version string `json:"version"`
		} `json:"pi"`
		CodeGraph struct {
			Version string `json:"version"`
		} `json:"codegraph"`
	}
	data, err := os.ReadFile(filepath.Join(root, "runtime.json"))
	if err != nil {
		return err
	}
	if err := json.Unmarshal(data, &config); err != nil || config.Schema != 1 || config.Pi.Version == "" {
		return fmt.Errorf("runtime.json inválido para diagnóstico")
	}
	if _, err := exec.LookPath("bun"); err != nil {
		return fmt.Errorf("Bun no disponible en PATH")
	}
	piBin := os.Getenv("N_EIN_PI_BIN")
	if piBin == "" {
		piBin, err = layout.PiBinary(config.Pi.Version)
		if err != nil {
			return err
		}
	}
	piPath, err := exec.LookPath(piBin)
	if err != nil {
		return fmt.Errorf("Pi no disponible: %s", piBin)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	data, err = exec.CommandContext(ctx, piPath, "--version").Output()
	if err != nil {
		return fmt.Errorf("Pi --version falló: %w", err)
	}
	actual := strings.TrimSpace(string(data))
	if actual != config.Pi.Version {
		return fmt.Errorf("versión de Pi incompatible: esperada %s, observada %s", config.Pi.Version, actual)
	}
	say(output, "// 001 RUNTIME · Pi %s · Bun disponible · autenticación no comprobada\n", actual)
	return checkCodeGraph(config.CodeGraph.Version, output)
}

// checkCodeGraph exige el índice de código: sin él, los agentes vuelven al grep a ciegas.
func checkCodeGraph(version string, output io.Writer) error {
	if version == "" {
		return fmt.Errorf("runtime.json no fija CodeGraph")
	}
	binary := os.Getenv("N_EIN_CODEGRAPH_BIN")
	if binary == "" {
		managed, err := layout.CodeGraphBinary(version)
		if err != nil {
			return err
		}
		binary = managed
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, binary, "--version")
	command.Env = append(os.Environ(), "DO_NOT_TRACK=1")
	data, err := command.Output()
	if err != nil {
		return fmt.Errorf("CodeGraph no disponible: %s; fix: n-ein-install runtime", binary)
	}
	if actual := strings.TrimSpace(string(data)); actual != version {
		return fmt.Errorf("versión de CodeGraph incompatible: esperada %s, observada %s", version, actual)
	}
	say(output, "// 002 CODEGRAPH · %s · índice por proyecto al abrir un agente", version)
	return nil
}
