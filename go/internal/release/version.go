// Package release comparte la semántica de versiones entre build y distribución.
package release

import (
	"fmt"
	"regexp"
	"strings"
)

var syntax = regexp.MustCompile(`^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$`)

type Version struct {
	Core       [3]string
	Pre, Build string
}

func numeric(s string) bool { return strings.Trim(s, "0123456789") == "" }
func Parse(s string) (Version, error) {
	m := syntax.FindStringSubmatch(s)
	if m == nil {
		return Version{}, fmt.Errorf("versión SemVer inválida: %q", s)
	}
	for _, p := range strings.Split(m[4], ".") {
		if len(p) > 1 && numeric(p) && p[0] == '0' {
			return Version{}, fmt.Errorf("identificador numérico con cero inicial: %s", p)
		}
	}
	return Version{Core: [3]string{m[1], m[2], m[3]}, Pre: m[4], Build: m[5]}, nil
}
func (v Version) Channel() string {
	if v.Pre == "" {
		return "stable"
	}
	return "preview"
}

// Los números se comparan por longitud para no desbordar con identificadores válidos grandes.
func numberCompare(a, b string) int {
	if len(a) < len(b) {
		return -1
	}
	if len(a) > len(b) {
		return 1
	}
	return strings.Compare(a, b)
}
func (v Version) Compare(other Version) int {
	for i, a := range v.Core {
		if c := numberCompare(a, other.Core[i]); c != 0 {
			return c
		}
	}
	if v.Pre == other.Pre {
		return 0
	}
	if v.Pre == "" {
		return 1
	}
	if other.Pre == "" {
		return -1
	}
	a, b := strings.Split(v.Pre, "."), strings.Split(other.Pre, ".")
	for i := 0; i < len(a) && i < len(b); i++ {
		x, y := a[i], b[i]
		c := 0
		switch {
		case numeric(x) && numeric(y):
			c = numberCompare(x, y)
		case numeric(x):
			c = -1
		case numeric(y):
			c = 1
		default:
			c = strings.Compare(x, y)
		}
		if c != 0 {
			return c
		}
	}
	if len(a) < len(b) {
		return -1
	}
	return 1
}
