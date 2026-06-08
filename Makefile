.PHONY: api web tunnel install-web help

help:  ## 사용 가능 명령
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

install-web:  ## web/ pnpm install
	cd web && pnpm install

api:  ## FastAPI on :8000
	.venv/bin/uvicorn mrms.api.main:app --host 127.0.0.1 --port 8000 --reload

web:  ## Next.js on :3500 (SSR fetch는 localhost:8000 직접)
	cd web && NEXT_PUBLIC_API_BASE=http://localhost:8000/api pnpm dev --port 3500

tunnel:  ## Cloudflare Tunnel (path-based ingress)
	cloudflared tunnel run mrms
