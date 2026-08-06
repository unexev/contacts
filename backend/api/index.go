package handler

import (
	"net/http"

	"contacts/pkg/server"
)

func Handler(w http.ResponseWriter, r *http.Request) {
	h, err := server.Handler()
	if err != nil {
		http.Error(w, `{"error":"server not initialized"}`, http.StatusInternalServerError)
		return
	}
	h.ServeHTTP(w, r)
}

func main() {}
