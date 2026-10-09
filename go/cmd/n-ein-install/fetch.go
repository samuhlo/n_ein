package main

// [FLOW] RELEASE REMOTA
// Selecciona, verifica y prepara el paquete antes de ejecutar SU instalador.
// El bootstrap puede ser antiguo: no impone su versión al paquete descargado.
import (
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"n_ein/internal/layout"
	"n_ein/internal/release"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

func fetch(args []string, output io.Writer) error {
	flags := flag.NewFlagSet("fetch", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	requested := flags.String("version", "", "versión exacta")
	channel := flags.String("channel", "", "preview o stable; por defecto stable")
	dry := flags.Bool("dry-run", false, "mostrar sin instalar")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if flags.NArg() != 0 {
		return fmt.Errorf("argumentos inesperados")
	}
	if *channel == "" {
		*channel = "stable"
		if *requested != "" {
			v, err := release.Parse(*requested)
			if err != nil {
				return err
			}
			*channel = v.Channel()
		}
	}
	platform := runtime.GOOS + "-" + runtime.GOARCH
	if platform != "darwin-arm64" && platform != "linux-amd64" {
		return fmt.Errorf("plataforma no soportada: %s", platform)
	}
	client := release.Client{API: os.Getenv("N_EIN_RELEASE_API")}
	chosen, err := client.Select(*channel, *requested, platform)
	if err != nil {
		return err
	}
	target, err := layout.Installation(*channel)
	if err != nil {
		return err
	}
	if err := protectTarget(target); err != nil {
		return err
	}
	if data, err := os.ReadFile(filepath.Join(target, "package-manifest.json")); err == nil && *requested == "" {
		var installed artifactManifest
		if err := json.Unmarshal(data, &installed); err != nil {
			return err
		}
		current, err := release.Parse(installed.Version)
		if err != nil {
			return err
		}
		next, _ := release.Parse(chosen.Version)
		if next.Compare(current) < 0 {
			return fmt.Errorf("la release %s es anterior a %s; usa --version para una restauración deliberada", chosen.Version, installed.Version)
		}
	}
	say(output, "// 000 RELEASE · %s · %s · %s\n", chosen.Version, *channel, platform)
	if *dry {
		say(output, "// 001 PLAN · %s · destino: %s\n", chosen.Archive, target)
		return nil
	}
	area, err := os.MkdirTemp("", "n-ein-download-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(area)
	source, err := prepareRemote(chosen, area)
	if err != nil {
		return err
	}
	cmd := exec.Command(filepath.Join(source, "bin", "n-ein-install"), "setup", "--source", source, "--channel", *channel)
	cmd.Stdin = os.Stdin
	cmd.Stdout = output
	cmd.Stderr = output
	return cmd.Run()
}
func prepareRemote(candidate release.Candidate, area string) (string, error) {
	checksum := filepath.Join(area, "checksum")
	if err := download(candidate.Checksum, checksum); err != nil {
		return "", err
	}
	data, err := os.ReadFile(checksum)
	if err != nil {
		return "", err
	}
	fields := strings.Fields(string(data))
	if len(fields) != 2 || len(fields[0]) != 64 || strings.TrimPrefix(fields[1], "*") != candidate.Name {
		return "", fmt.Errorf("archivo de checksum inválido")
	}
	if _, err := hex.DecodeString(fields[0]); err != nil {
		return "", fmt.Errorf("SHA-256 inválido")
	}
	archive := filepath.Join(area, "package.tar.gz")
	if err := download(candidate.Archive, archive); err != nil {
		return "", err
	}
	actual, err := fileSHA256(archive)
	if err != nil {
		return "", err
	}
	if actual != fields[0] {
		return "", fmt.Errorf("SHA-256 del paquete incorrecto; instalación intacta")
	}
	source := filepath.Join(area, "package")
	if err := os.Mkdir(source, 0700); err != nil {
		return "", err
	}
	if err := extractRelease(archive, source); err != nil {
		return "", err
	}
	meta, err := validateArtifact(source)
	if err != nil {
		return "", err
	}
	if meta.Version != candidate.Version {
		return "", fmt.Errorf("versión del manifiesto no coincide con release")
	}
	return source, nil
}
