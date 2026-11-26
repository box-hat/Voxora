# Voxora: Angular frontend + ASP.NET Core API in one image.
# The API serves the built frontend, so the whole app is a single origin.

# ---- 1. Build the Angular app ---------------------------------------------
FROM node:24-alpine AS web
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY angular.json tsconfig.json tsconfig.app.json ./
COPY public ./public
COPY src ./src
RUN npx ng build --configuration production

# ---- 2. Build the API -----------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api
WORKDIR /src
COPY Voxora.Api/Voxora.Api.csproj Voxora.Api/
RUN dotnet restore Voxora.Api/Voxora.Api.csproj
COPY Voxora.Api/ Voxora.Api/
RUN dotnet publish Voxora.Api/Voxora.Api.csproj -c Release -o /out --no-restore /p:UseAppHost=false

# ---- 3. Runtime -------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=api /out ./
COPY --from=web /src/dist/compostay/browser ./wwwroot

ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_HTTP_PORTS=8080 \
    DataProtection__KeysPath=/keys

RUN mkdir -p /keys && chown app:app /keys
VOLUME /keys

USER app
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["dotnet", "Voxora.Api.dll", "--healthcheck"]

ENTRYPOINT ["dotnet", "Voxora.Api.dll"]
