package server

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func SPA() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		buildDir := filepath.Join("..", "web", "build")

		// Try to serve the static file
		path := filepath.Join(buildDir, r.URL.Path)
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			http.ServeFile(w, r, path)
			return
		}

		// For non-file requests, try specific extensions
		if strings.HasSuffix(r.URL.Path, ".js") || strings.HasSuffix(r.URL.Path, ".css") ||
			strings.HasSuffix(r.URL.Path, ".png") || strings.HasSuffix(r.URL.Path, ".ico") ||
			strings.HasSuffix(r.URL.Path, ".svg") || strings.HasSuffix(r.URL.Path, ".woff") ||
			strings.HasSuffix(r.URL.Path, ".woff2") {
			http.NotFound(w, r)
			return
		}

		// SPA fallback: serve index.html
		http.ServeFile(w, r, filepath.Join(buildDir, "index.html"))
	})
}
