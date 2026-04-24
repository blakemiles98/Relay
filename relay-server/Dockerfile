# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY *.csproj ./
RUN dotnet restore

COPY . ./
RUN dotnet publish -c Release -o /out --no-restore

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# ffmpeg is required for transcoding and trickplay generation.
# The GPU encoder (NVENC/AMF) is selected at runtime by auto-detect —
# the image itself stays GPU-agnostic. GPU access is granted via
# docker-compose device flags or --gpus, not baked into this image.
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

COPY --from=build /out ./

# Create default config directory (can be overridden by volume mount)
RUN mkdir -p /config/transcode-cache /config/logs

EXPOSE 5000
ENTRYPOINT ["dotnet", "RelayServer.dll"]
