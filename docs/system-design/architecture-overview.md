# Architecture Overview

Dokumen ini mengikuti rekomendasi `prd.md`:

* `services/api` sebagai modular monolith untuk core business rules
* `services/media-hooks` sebagai proses terpisah untuk mengontrol transisi `LIVE`
* `services/worker` untuk reconciliation state yang time-based
* packages contracts dan domain dibagi supaya payload schema dan business rules tidak diinvent per service

