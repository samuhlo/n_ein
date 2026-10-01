package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

var version = "0.1.0-dev"

type fileRecord struct {
	Path   string `json:"path"`
	SHA256 string `json:"sha256"`
	Mode   uint32 `json:"mode"`
}

type manifest struct {
	Version string       `json:"version"`
	Channel string       `json:"channel"`
	Files   []fileRecord `json:"files"`
}

type artifactManifest struct {
	Version string       `json:"version"`
	Commit  string       `json:"commit"`
	Digest  string       `json:"digest"`
	Files   []fileRecord `json:"files"`
}

type sourceFile struct {
	from string
	rel  string
	mode fs.FileMode
}

func inside(parent, path string) bool {
	rel, err := filepath.Rel(parent, path)
	return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

func resolvedPath(path string) (string, error) {
	ancestor := path
	var missing []string
	for {
		if _, err := os.Lstat(ancestor); err == nil {
			break
		} else if !errors.Is(err, os.ErrNotExist) {
			return "", err
		}
		parent := filepath.Dir(ancestor)
		if parent == ancestor {
			return "", fmt.Errorf("no existe un ancestro de %s", path)
		}
		missing = append(missing, filepath.Base(ancestor))
		ancestor = parent
	}
	actual, err := filepath.EvalSymlinks(ancestor)
	if err != nil {
		return "", err
	}
	for i := len(missing) - 1; i >= 0; i-- {
		actual = filepath.Join(actual, missing[i])
	}
	return actual, nil
}

func protectTarget(target string) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	// BLINDAJE -> Comparar rutas canónicas impide saltarse la protección con HOME enlazado.
	home, err = resolvedPath(home)
	if err != nil {
		return err
	}
	actual, err := resolvedPath(target)
	if err != nil {
		return err
	}
	if inside(actual, home) {
		return fmt.Errorf("destino contiene el hogar del usuario: %s", target)
	}
	if actual == filepath.Join(home, ".n_ein", "installations") {
		return fmt.Errorf("destino contiene todos los canales: %s", target)
	}
	for _, forbidden := range []string{
		".pi", ".pi-ein", ".claude", ".claude-ein",
		filepath.Join(".n_ein", "dev"), filepath.Join(".n_ein", "preview"), filepath.Join(".n_ein", "stable"),
		filepath.Join("Documents", "01_Proyectos", "ein-agent"),
	} {
		protected := filepath.Join(home, forbidden)
		if inside(protected, actual) || inside(actual, protected) {
			return fmt.Errorf("destino protegido: %s", target)
		}
	}
	if info, err := os.Lstat(target); err == nil && info.Mode()&os.ModeSymlink != 0 {
		return fmt.Errorf("destino es un enlace simbólico: %s", target)
	}
	return nil
}

// [DATA] El paquete contiene solo superficies ejecutables; las fuentes históricas quedan fuera.
func collect(source, self string) ([]sourceFile, error) {
	var files []sourceFile
	add := func(from, rel string) error {
		info, err := os.Lstat(from)
		if err != nil {
			return fmt.Errorf("falta %s: %w", rel, err)
		}
		if !info.Mode().IsRegular() {
			return fmt.Errorf("archivo no regular en paquete: %s", rel)
		}
		files = append(files, sourceFile{from: from, rel: rel, mode: info.Mode().Perm()})
		return nil
	}
	for _, rel := range []string{
		"brand.json", "runtime.json", "bin/n-ein-dev", "bin/n-ein-claude-dev", "bin/n-ein-prepare-pi",
		"pi-package/package.json", "pi-package/persona.md", "pi-package/pi-only.md", "pi-package/models.ts",
	} {
		if err := add(filepath.Join(source, rel), rel); err != nil {
			return nil, err
		}
	}
	if err := add(self, "bin/n-ein-install"); err != nil {
		return nil, err
	}
	launcher := filepath.Join(source, "dist", "n-ein")
	if _, err := os.Stat(launcher); errors.Is(err, os.ErrNotExist) {
		launcher = filepath.Join(source, "bin", "n-ein")
	}
	if err := add(launcher, "bin/n-ein"); err != nil {
		return nil, err
	}
	for _, rel := range []string{"pi-package/extensions", "pi-package/themes"} {
		if err := walkFiles(filepath.Join(source, rel), source, add); err != nil {
			return nil, err
		}
	}
	skillsRoot := filepath.Join(source, "pi-package", "skills")
	entries, err := os.ReadDir(skillsRoot)
	if err != nil {
		return nil, err
	}
	skillCount := 0
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		dir := filepath.Join(skillsRoot, entry.Name())
		if _, err := os.Stat(filepath.Join(dir, "SKILL.md")); err != nil {
			continue // Cachés descargadas no son skills propias del catálogo.
		}
		if err := walkFiles(dir, source, add); err != nil {
			return nil, err
		}
		skillCount++
	}
	if skillCount == 0 {
		return nil, fmt.Errorf("el catálogo de skills está vacío")
	}
	sort.Slice(files, func(i, j int) bool { return files[i].rel < files[j].rel })
	return files, nil
}

func walkFiles(root, source string, add func(string, string) error) error {
	return filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(source, path)
		if err != nil {
			return err
		}
		return add(path, rel)
	})
}

func copyFile(from, to string, mode fs.FileMode) error {
	if err := os.MkdirAll(filepath.Dir(to), 0o755); err != nil {
		return err
	}
	in, err := os.Open(from)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(to, os.O_CREATE|os.O_EXCL|os.O_WRONLY, mode)
	if err != nil {
		return err
	}
	if _, err = io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	if err = out.Close(); err != nil {
		return err
	}
	return os.Chmod(to, mode)
}

func hashFile(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

func fileRecords(stage string, files []sourceFile) ([]fileRecord, error) {
	records := make([]fileRecord, 0, len(files)+1)
	for _, file := range files {
		hash, err := hashFile(filepath.Join(stage, file.rel))
		if err != nil {
			return nil, err
		}
		records = append(records, fileRecord{Path: filepath.ToSlash(file.rel), SHA256: hash, Mode: uint32(file.mode.Perm())})
	}
	sort.Slice(records, func(i, j int) bool { return records[i].Path < records[j].Path })
	return records, nil
}

func writeManifest(stage, channel string, files []sourceFile) error {
	records, err := fileRecords(stage, files)
	if err != nil {
		return err
	}
	marker := filepath.Join(stage, ".n-ein-channel")
	if err := os.WriteFile(marker, []byte(channel+"\n"), 0o644); err != nil {
		return err
	}
	hash, err := hashFile(marker)
	if err != nil {
		return err
	}
	records = append(records, fileRecord{Path: ".n-ein-channel", SHA256: hash, Mode: 0o644})
	sort.Slice(records, func(i, j int) bool { return records[i].Path < records[j].Path })
	data, err := json.MarshalIndent(manifest{Version: version, Channel: channel, Files: records}, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(stage, "install.json"), append(data, '\n'), 0o644)
}

func verifyFiles(root string, records []fileRecord) error {
	for _, item := range records {
		rel := filepath.FromSlash(item.Path)
		if rel == "." || filepath.IsAbs(rel) || strings.HasPrefix(rel, "..") || filepath.Clean(rel) != rel {
			return fmt.Errorf("ruta inválida en manifest: %s", item.Path)
		}
		path := filepath.Join(root, rel)
		info, err := os.Lstat(path)
		if err != nil {
			return err
		}
		if !info.Mode().IsRegular() || uint32(info.Mode().Perm()) != item.Mode {
			return fmt.Errorf("modo o tipo incorrecto: %s", rel)
		}
		hash, err := hashFile(path)
		if err != nil {
			return err
		}
		if hash != item.SHA256 {
			return fmt.Errorf("hash incorrecto: %s", rel)
		}
	}
	return nil
}

func validate(target string) (manifest, error) {
	data, err := os.ReadFile(filepath.Join(target, "install.json"))
	if err != nil {
		return manifest{}, err
	}
	var meta manifest
	if err := json.Unmarshal(data, &meta); err != nil {
		return manifest{}, err
	}
	if meta.Channel != "preview" && meta.Channel != "stable" {
		return manifest{}, fmt.Errorf("canal inválido en instalación")
	}
	if meta.Version == "" {
		return manifest{}, fmt.Errorf("versión ausente en instalación")
	}
	if len(meta.Files) == 0 {
		return manifest{}, fmt.Errorf("manifest sin archivos")
	}
	if err := verifyFiles(target, meta.Files); err != nil {
		return manifest{}, err
	}
	marker, err := os.ReadFile(filepath.Join(target, ".n-ein-channel"))
	if err != nil || strings.TrimSpace(string(marker)) != meta.Channel {
		return manifest{}, fmt.Errorf("canal y marcador no coinciden")
	}
	return meta, nil
}

func recordsDigest(records []fileRecord) string {
	hash := sha256.New()
	for _, item := range records {
		fmt.Fprintf(hash, "%s\x00%s\x00%d\n", item.Path, item.SHA256, item.Mode)
	}
	return hex.EncodeToString(hash.Sum(nil))
}

func writeArtifactManifest(stage, source string, files []sourceFile) error {
	records, err := fileRecords(stage, files)
	if err != nil {
		return err
	}
	commit := "desconocido"
	if output, err := exec.Command("git", "-C", source, "rev-parse", "HEAD").Output(); err == nil {
		commit = strings.TrimSpace(string(output))
		if status, err := exec.Command("git", "-C", source, "status", "--porcelain").Output(); err == nil && len(status) > 0 {
			commit += "+dirty"
		}
	}
	data, err := json.MarshalIndent(artifactManifest{Version: version, Commit: commit, Digest: recordsDigest(records), Files: records}, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(stage, "package-manifest.json"), append(data, '\n'), 0o644)
}

func validateArtifact(source string) (artifactManifest, error) {
	data, err := os.ReadFile(filepath.Join(source, "package-manifest.json"))
	if err != nil {
		return artifactManifest{}, err
	}
	var meta artifactManifest
	if err := json.Unmarshal(data, &meta); err != nil {
		return artifactManifest{}, err
	}
	if meta.Version == "" || len(meta.Files) == 0 || recordsDigest(meta.Files) != meta.Digest {
		return artifactManifest{}, fmt.Errorf("manifest de paquete inválido")
	}
	if err := verifyFiles(source, meta.Files); err != nil {
		return artifactManifest{}, err
	}
	return meta, nil
}

func packageArtifact(source, output, self string, dryRun bool, writer io.Writer) error {
	if _, err := os.Lstat(output); err == nil {
		return fmt.Errorf("ya existe el paquete: %s", output)
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	files, err := collect(source, self)
	if err != nil {
		return err
	}
	if dryRun {
		fmt.Fprintf(writer, "// 000 PLAN · package · %s · %d archivos\n", output, len(files))
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(output), 0o755); err != nil {
		return err
	}
	stage, err := os.MkdirTemp(filepath.Dir(output), ".n-ein-package-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(stage)
	for _, file := range files {
		if err := copyFile(file.from, filepath.Join(stage, file.rel), file.mode); err != nil {
			return err
		}
	}
	if err := writeArtifactManifest(stage, source, files); err != nil {
		return err
	}
	meta, err := validateArtifact(stage)
	if err != nil {
		return err
	}
	if err := os.Rename(stage, output); err != nil {
		return err
	}
	fmt.Fprintf(writer, "// 000 PAQUETE · %s · sha256: %s\n", output, meta.Digest)
	return nil
}

func backupPath(target, prefix string) (string, error) {
	dir := target + ".backups"
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	return filepath.Join(dir, fmt.Sprintf("%s-%d", prefix, time.Now().UnixNano())), nil
}

func install(source, target, channel, self string, requireExisting, dryRun bool, output io.Writer) error {
	artifactPath := filepath.Join(source, "package-manifest.json")
	if _, err := os.Stat(artifactPath); err == nil {
		if _, err := validateArtifact(source); err != nil {
			return fmt.Errorf("paquete inválido: %w", err)
		}
		// BLINDAJE -> Preview y estable copian el mismo instalador del artefacto.
		self = filepath.Join(source, "bin", "n-ein-install")
	}
	files, err := collect(source, self)
	if err != nil {
		return err
	}
	if _, err := os.Stat(artifactPath); err == nil {
		info, err := os.Lstat(artifactPath)
		if err != nil {
			return err
		}
		files = append(files, sourceFile{from: artifactPath, rel: "package-manifest.json", mode: info.Mode().Perm()})
		sort.Slice(files, func(i, j int) bool { return files[i].rel < files[j].rel })
	}
	_, statErr := os.Lstat(target)
	exists := statErr == nil
	if statErr != nil && !errors.Is(statErr, os.ErrNotExist) {
		return statErr
	}
	if requireExisting && !exists {
		return fmt.Errorf("update requiere instalación existente: %s", target)
	}
	if exists {
		// BLINDAJE -> El backup y reemplazo solo se aplican a una instalación identificada.
		if err := managed(target); err != nil {
			return fmt.Errorf("destino existente no es instalación de n_ein: %s: %w", target, err)
		}
	}
	if dryRun {
		fmt.Fprintf(output, "// 000 PLAN · %s · %s · %d archivos · backup: %t\n", channel, target, len(files)+1, exists)
		return nil
	}

	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return err
	}
	stage, err := os.MkdirTemp(filepath.Dir(target), ".n-ein-stage-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(stage)
	for _, file := range files {
		if err := copyFile(file.from, filepath.Join(stage, file.rel), file.mode); err != nil {
			return err
		}
	}
	if err := writeManifest(stage, channel, files); err != nil {
		return err
	}
	if _, err := os.Stat(artifactPath); err == nil {
		if _, err := validateArtifact(stage); err != nil {
			return fmt.Errorf("paquete cambió durante instalación: %w", err)
		}
	}
	if _, err := validate(stage); err != nil {
		return err
	}

	backup := ""
	if exists {
		backup, err = backupPath(target, "backup")
		if err != nil {
			return err
		}
		if err := os.Rename(target, backup); err != nil {
			return err
		}
	}
	if err := os.Rename(stage, target); err != nil {
		if backup != "" {
			if rollbackErr := os.Rename(backup, target); rollbackErr != nil {
				return fmt.Errorf("instalación falló: %w; rollback falló: %v", err, rollbackErr)
			}
		}
		return err
	}
	fmt.Fprintf(output, "// 000 INSTALADO · %s · %s\n", channel, target)
	return nil
}

func copyTree(from, to string) error {
	return filepath.WalkDir(from, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(from, path)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}
		dest := filepath.Join(to, rel)
		if entry.IsDir() {
			return os.MkdirAll(dest, 0o755)
		}
		info, err := os.Lstat(path)
		if err != nil {
			return err
		}
		if !info.Mode().IsRegular() {
			return fmt.Errorf("archivo no regular en backup: %s", rel)
		}
		return copyFile(path, dest, info.Mode().Perm())
	})
}

func latestBackup(target string) (string, error) {
	entries, err := os.ReadDir(target + ".backups")
	if err != nil {
		return "", err
	}
	var names []string
	for _, entry := range entries {
		if entry.IsDir() && strings.HasPrefix(entry.Name(), "backup-") {
			names = append(names, entry.Name())
		}
	}
	if len(names) == 0 {
		return "", fmt.Errorf("no hay backup para restaurar")
	}
	sort.Strings(names)
	for i := len(names) - 1; i >= 0; i-- {
		candidate := filepath.Join(target+".backups", names[i])
		if _, err := validate(candidate); err == nil {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("no hay backup válido para restaurar")
}

func restore(target string, dryRun bool, output io.Writer) error {
	backup, err := latestBackup(target)
	if err != nil {
		return err
	}
	if _, err := validate(backup); err != nil {
		return fmt.Errorf("backup inválido: %w", err)
	}
	if dryRun {
		fmt.Fprintf(output, "// 000 PLAN · restore · %s → %s\n", backup, target)
		return nil
	}
	stage, err := os.MkdirTemp(filepath.Dir(target), ".n-ein-restore-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(stage)
	if err := copyTree(backup, stage); err != nil {
		return err
	}
	if _, err := validate(stage); err != nil {
		return err
	}
	current := ""
	if _, err := os.Lstat(target); err == nil {
		current, err = backupPath(target, "recovery")
		if err != nil {
			return err
		}
		if err := os.Rename(target, current); err != nil {
			return err
		}
	}
	if err := os.Rename(stage, target); err != nil {
		if current != "" {
			if rollbackErr := os.Rename(current, target); rollbackErr != nil {
				return fmt.Errorf("restore falló: %w; rollback falló: %v", err, rollbackErr)
			}
		}
		return err
	}
	fmt.Fprintf(output, "// 000 RESTAURADO · %s\n", target)
	return nil
}

func uninstall(target string, dryRun bool, output io.Writer) error {
	if err := managed(target); err != nil {
		return err
	}
	if dryRun {
		fmt.Fprintf(output, "// 000 PLAN · uninstall · %s · datos de usuario separados\n", target)
		return nil
	}
	backup, err := backupPath(target, "backup")
	if err != nil {
		return err
	}
	if err := os.Rename(target, backup); err != nil {
		return err
	}
	fmt.Fprintf(output, "// 000 DESINSTALADO · backup: %s · datos conservados\n", backup)
	return nil
}

func managed(target string) error {
	channel, err := os.ReadFile(filepath.Join(target, ".n-ein-channel"))
	if err != nil {
		return err
	}
	value := strings.TrimSpace(string(channel))
	if value != "preview" && value != "stable" {
		return fmt.Errorf("marcador de canal inválido: %s", target)
	}
	if _, err := os.Stat(filepath.Join(target, "install.json")); err != nil {
		return err
	}
	return nil
}
