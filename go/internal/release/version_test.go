package release

import "testing"

func TestVersion(t *testing.T) {
	for _, v := range []string{"0.2.0-alpha.1", "0.2.0-rc.1", "0.2.0", "0.2.1", "0.1.0-preview.3", "0.1.0-preview.1.hotfix.1", "0.2.0-alpha.1+hotfix.abc1234"} {
		if _, err := Parse(v); err != nil {
			t.Fatalf("%s: %v", v, err)
		}
	}
	for _, v := range []string{"v0.2.0", "0.2", "0.02.0", "0.2.0-alpha.01", "0.2.0-", "../../x", "0.2.0\n"} {
		if _, err := Parse(v); err == nil {
			t.Fatalf("accepted %q", v)
		}
	}
	ordered := []string{"0.1.0-alpha.1", "0.1.0-preview.3", "0.2.0-alpha.2", "0.2.0-alpha.10", "0.2.0-rc.1", "0.2.0", "0.2.1"}
	for i := 1; i < len(ordered); i++ {
		a, _ := Parse(ordered[i-1])
		b, _ := Parse(ordered[i])
		if a.Compare(b) >= 0 {
			t.Fatal(ordered[i])
		}
	}
	a, _ := Parse("0.2.0-alpha.1+git.a")
	b, _ := Parse("0.2.0-alpha.1+git.b")
	if a.Compare(b) != 0 || a.Channel() != "preview" {
		t.Fatal("metadata/channel")
	}
	c, _ := Parse("0.2.0")
	if c.Channel() != "stable" {
		t.Fatal("stable")
	}
}
