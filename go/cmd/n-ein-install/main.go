// Package main provides the repair path for local n_ein installations.
package main

import (
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
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
		return fmt.Errorf("uso: n-ein-install <package|install|update|doctor|restore|uninstall> [flags]")
	}
	verb := args[0]
	if verb != "package" && verb != "install" && verb != "update" && verb != "doctor" && verb != "restore" && verb != "uninstall" {
		return fmt.Errorf("verbo desconocido: %s", verb)
	}

	flags := flag.NewFlagSet(verb, flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	source := flags.String("source", ".", "directorio fuente de n_ein")
	artifactPath := flags.String("output", "", "salida inmutable del paquete local")
	target := flags.String("target", "", "directorio de código instalado")
	channel := flags.String("channel", "preview", "preview o stable")
	dryRun := flags.Bool("dry-run", false, "mostrar sin mutar")
	if err := flags.Parse(args[1:]); err != nil {
		return err
	}
	if flags.NArg() != 0 {
		return fmt.Errorf("argumentos inesperados: %v", flags.Args())
	}
	if *channel != "preview" && *channel != "stable" {
		return fmt.Errorf("canal inválido: %s", *channel)
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
	if *target == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return err
		}
		*target = filepath.Join(home, ".n_ein", "installations", *channel)
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
		actualSource, err := resolvedPath(absSource)
		if err != nil {
			return err
		}
		actualTarget, err := resolvedPath(absTarget)
		if err != nil {
			return err
		}
		if inside(actualSource, actualTarget) || inside(actualTarget, actualSource) {
			return fmt.Errorf("fuente y destino no pueden solaparse")
		}
		return install(absSource, absTarget, *channel, self, verb == "update", *dryRun, output)
	case "doctor":
		manifest, err := validate(absTarget)
		if err != nil {
			return err
		}
		fmt.Fprintf(output, "// 000 ESTADO · %s · %s · %d archivos verificados\n", manifest.Channel, manifest.Version, len(manifest.Files))
		return nil
	case "restore":
		return restore(absTarget, *dryRun, output)
	default:
		return uninstall(absTarget, *dryRun, output)
	}
}
