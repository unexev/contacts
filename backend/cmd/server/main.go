package main

import (
	"log"
	"net/http"
	"os"

	"contacts/pkg/server"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	addr := ":" + port
	log.Printf("starting server on %s", addr)
	h := server.HandlerOrFatal()
	if err := http.ListenAndServe(addr, h); err != nil {
		log.Fatal(err)
	}
}
