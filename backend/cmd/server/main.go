package main

import (
	"log"
	"net/http"

	"contacts/pkg/server"
)

func main() {
	addr := ":8080"
	log.Printf("starting server on %s", addr)
	h := server.HandlerOrFatal()
	if err := http.ListenAndServe(addr, h); err != nil {
		log.Fatal(err)
	}
}
