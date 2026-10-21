package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestPreviewerEntryOpensReviewedHeadAndProposesTheRest(t *testing.T) {
	session, head, old := "s", "b", "a"
	cases := []struct {
		name   string
		status previewerStatus
		ok     bool
		note   string
		action string
	}{
		{"sin revisor", previewerStatus{}, false, "no disponible", ""},
		{"rama nueva", previewerStatus{Head: head, Reviewable: true}, true, "revisar la rama", "previewer:review"},
		{"solo fallidas", previewerStatus{Head: head, Reviewable: true, Session: &session}, true, "revisar la rama", "previewer:review"},
		{"sin cambios", previewerStatus{Head: head}, true, "sin cambios propios", ""},
		{"head nuevo", previewerStatus{Head: head, Reviewable: true, Session: &session, Reviewed: &old}, true, "volver a revisar", "previewer:review"},
		{"revisada", previewerStatus{Head: head, Reviewable: true, Session: &session, Reviewed: &head, Current: 2}, true, "2 vigentes", "previewer:open"},
		{"limpia", previewerStatus{Head: head, Reviewable: true, Session: &session, Reviewed: &head}, true, "sin hallazgos", "previewer:open"},
	}
	for _, item := range cases {
		got := previewerItem(item.status, item.ok)
		if got.label != "Revisor" || got.key != "r" || got.note != item.note || got.action != item.action {
			t.Fatalf("%s: %#v", item.name, got)
		}
	}
}

func TestPreviewerStatusComesFromThePackageEntry(t *testing.T) {
	root := t.TempDir()
	if _, ok := readPreviewer(root, root); ok {
		t.Fatal("sin bin/n-ein-previewer no hay revisor")
	}
	write(t, filepath.Join(root, "bin", "n-ein-previewer"), "#!/bin/sh\n[ \"$1\" = status ] || exit 64\necho '{\"head\":\"b\",\"reviewable\":true,\"session\":\"s\",\"reviewed\":\"b\",\"current\":1}'\n")
	if err := os.Chmod(filepath.Join(root, "bin", "n-ein-previewer"), 0o755); err != nil {
		t.Fatal(err)
	}
	status, ok := readPreviewer(root, root)
	if !ok || previewerItem(status, ok).note != "1 vigente" {
		t.Fatalf("estado del revisor: %#v %v", status, ok)
	}
}
