package release

// [DATA] Selección por canal y SemVer entre releases publicadas y completas.
// GitHub /latest excluye alphas; no sirve para decidir la preview.
import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type Asset struct {
	Name string `json:"name"`
	URL  string `json:"browser_download_url"`
}
type Published struct {
	Tag        string  `json:"tag_name"`
	Draft      bool    `json:"draft"`
	Prerelease bool    `json:"prerelease"`
	Assets     []Asset `json:"assets"`
}
type Candidate struct{ Version, Archive, Checksum, Name string }
type Client struct {
	API  string
	HTTP *http.Client
}

func (c Client) get(path string, into any) error {
	client := c.HTTP
	if client == nil {
		client = &http.Client{Timeout: 30 * time.Second}
	}
	base := c.API
	if base == "" {
		base = "https://api.github.com/repos/samuhlo/n_ein"
	}
	req, err := http.NewRequest("GET", strings.TrimRight(base, "/")+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "n-ein-installer")
	response, err := client.Do(req)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("releases: HTTP %d", response.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(response.Body, 8<<20)).Decode(into)
}
func candidate(r Published, channel, platform string) (Candidate, bool) {
	if r.Draft || !strings.HasPrefix(r.Tag, "v") {
		return Candidate{}, false
	}
	version := strings.TrimPrefix(r.Tag, "v")
	parsed, err := Parse(version)
	if err != nil || parsed.Build != "" || parsed.Channel() != channel || r.Prerelease != (parsed.Pre != "") {
		return Candidate{}, false
	}
	prefix := "n-ein-" + version + "-" + platform + ".tar.gz"
	out := Candidate{Version: version, Name: prefix}
	for _, asset := range r.Assets {
		switch asset.Name {
		case prefix:
			out.Archive = asset.URL
		case prefix + ".sha256":
			out.Checksum = asset.URL
		}
	}
	return out, out.Archive != "" && out.Checksum != ""
}
func (c Client) Select(channel, version, platform string) (Candidate, error) {
	if channel != "preview" && channel != "stable" {
		return Candidate{}, fmt.Errorf("canal inválido: %s", channel)
	}
	if version != "" {
		parsed, err := Parse(version)
		if err != nil {
			return Candidate{}, err
		}
		if parsed.Channel() != channel || parsed.Build != "" {
			return Candidate{}, fmt.Errorf("versión incompatible con canal %s", channel)
		}
		var published Published
		if err := c.get("/releases/tags/"+url.PathEscape("v"+version), &published); err != nil {
			return Candidate{}, err
		}
		if out, ok := candidate(published, channel, platform); ok && out.Version == version {
			return out, nil
		}
		return Candidate{}, fmt.Errorf("release incompleta o no publicada: %s", version)
	}
	var best Candidate
	for page := 1; page <= 100; page++ {
		var all []Published
		if err := c.get(fmt.Sprintf("/releases?per_page=100&page=%d", page), &all); err != nil {
			return Candidate{}, err
		}
		for _, r := range all {
			if out, ok := candidate(r, channel, platform); ok {
				a, _ := Parse(out.Version)
				b, _ := Parse(best.Version)
				if best.Version == "" || a.Compare(b) > 0 {
					best = out
				}
			}
		}
		if len(all) < 100 {
			if best.Version != "" {
				return best, nil
			}
			return Candidate{}, fmt.Errorf("no hay release %s completa para %s; elige una versión publicada", channel, platform)
		}
	}
	return Candidate{}, fmt.Errorf("demasiadas releases: indica --version")
}
