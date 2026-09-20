$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Marketplace = "Giorgosfl/codex-smart-worker"
$MarketplaceName = "codex-smart-worker"
$Plugin = "codex-smart-worker@codex-smart-worker"
$CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path ([Environment]::GetFolderPath("UserProfile")) ".codex" }
$CredentialsDirectory = Join-Path $CodexHome "codex-smart-worker\credentials"
$CredentialFiles = @{
    typesafe = (Join-Path $CredentialsDirectory "TYPESAFE_API_KEY")
    deepseek = (Join-Path $CredentialsDirectory "DEEPSEEK_API_KEY")
}
$CredentialLabels = @{
    typesafe = "TypeSafe API key"
    deepseek = "DeepSeek API key"
}

function Fail([string]$Message) {
    throw "Codex Smart Worker: $Message"
}

function Select-Action {
    while ($true) {
        Write-Host ""
        Write-Host "+--------------------------------------------+"
        Write-Host "|       Codex Smart Worker Installer v3      |"
        Write-Host "+--------------------------------------------+"
        Write-Host ""
        Write-Host "  1) Install plugin and set up both API keys"
        Write-Host "  2) Change TypeSafe API key"
        Write-Host "  3) Change DeepSeek API key"
        Write-Host "  4) Remove TypeSafe API key"
        Write-Host "  5) Remove DeepSeek API key"
        Write-Host "  6) Remove both API keys"
        Write-Host "  7) Uninstall plugin and remove both API keys"
        Write-Host "  8) Exit"
        Write-Host ""

        switch (Read-Host "Choose an option [1-8]") {
            "1" { return @("install", "") }
            "2" { return @("change", "typesafe") }
            "3" { return @("change", "deepseek") }
            "4" { return @("remove", "typesafe") }
            "5" { return @("remove", "deepseek") }
            "6" { return @("remove", "all") }
            "7" { return @("uninstall", "") }
            "8" { Write-Host "Goodbye."; exit 0 }
            default { Write-Host "Please choose a number from 1 to 8." }
        }
    }
}

function Protect-CredentialFile([string]$Path) {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    & icacls.exe $Path /inheritance:r /grant:r "${identity}:(F)" | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail "could not restrict access to the local credential file." }
}

function Save-Key([string]$Target) {
    if (-not $CredentialFiles.ContainsKey($Target)) { Fail "choose typesafe, deepseek, or all." }

    $label = $CredentialLabels[$Target]
    Write-Host ""
    Write-Host "Paste your $label, then press Enter."
    Write-Host "Nothing will appear while you type or paste."
    $secure = Read-Host -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
        if ([string]::IsNullOrWhiteSpace($value)) { Fail "$label cannot be empty." }

        New-Item -ItemType Directory -Path $CredentialsDirectory -Force | Out-Null
        Protect-CredentialFile $CredentialsDirectory
        [IO.File]::WriteAllText($CredentialFiles[$Target], $value, [Text.UTF8Encoding]::new($false))
        Protect-CredentialFile $CredentialFiles[$Target]
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
        $value = $null
    }

    Write-Host "Saved $label in a private local file."
}

function Change-Keys([string]$Target) {
    switch ($Target) {
        "typesafe" { Save-Key "typesafe" }
        "deepseek" { Save-Key "deepseek" }
        "all" { Save-Key "typesafe"; Save-Key "deepseek" }
        default { Fail "choose typesafe, deepseek, or all." }
    }
}

function Delete-Keys([string]$Target) {
    switch ($Target) {
        "typesafe" { Remove-Item $CredentialFiles.typesafe -Force -ErrorAction SilentlyContinue }
        "deepseek" { Remove-Item $CredentialFiles.deepseek -Force -ErrorAction SilentlyContinue }
        "all" {
            Remove-Item $CredentialFiles.typesafe -Force -ErrorAction SilentlyContinue
            Remove-Item $CredentialFiles.deepseek -Force -ErrorAction SilentlyContinue
        }
        default { Fail "choose typesafe, deepseek, or all." }
    }

    if ((Test-Path $CredentialsDirectory) -and -not (Get-ChildItem $CredentialsDirectory -Force)) {
        Remove-Item $CredentialsDirectory -Force
    }
}

function Remove-Keys([string]$Target) {
    $description = switch ($Target) {
        "typesafe" { "the TypeSafe API key" }
        "deepseek" { "the DeepSeek API key" }
        "all" { "both API keys" }
        default { Fail "choose typesafe, deepseek, or all." }
    }

    if ((Read-Host "Permanently remove $description from this computer? [y/N]") -notmatch "^(?i:y|yes)$") {
        Write-Host "Nothing was removed."
        return
    }

    Delete-Keys $Target
    Write-Host "Removed $description from this computer."
}

function Check-Requirements {
    if (-not (Get-Command codex -ErrorAction SilentlyContinue)) { Fail "Codex is not installed or is not available in this terminal." }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail "Node.js 20 or newer is required." }
    $nodeMajor = [int](& node -p 'process.versions.node.split(".")[0]')
    if ($nodeMajor -lt 20) { Fail "Node.js 20 or newer is required." }
}

function Uninstall-Plugin {
    if (-not (Get-Command codex -ErrorAction SilentlyContinue)) { Fail "Codex is not installed or is not available in this terminal." }
    if ((Read-Host "Uninstall Codex Smart Worker and permanently remove both saved API keys? [y/N]") -notmatch "^(?i:y|yes)$") {
        Write-Host "Nothing was removed."
        return
    }

    & codex plugin remove $Plugin
    & codex plugin marketplace remove $MarketplaceName
    Delete-Keys "all"
    Write-Host "Codex Smart Worker, its marketplace, and both local API-key files were removed."
}

$Action = if ($args.Count -gt 0) { $args[0] } else { "" }
$Target = if ($args.Count -gt 1) { $args[1] } else { "" }

if (-not $Action) {
    $selection = Select-Action
    $Action = $selection[0]
    $Target = $selection[1]
}

switch ($Action) {
    "install" {
        Check-Requirements
        Write-Host "Installing Codex Smart Worker..."
        & codex plugin marketplace add $Marketplace
        if ($LASTEXITCODE -ne 0) { Fail "marketplace installation failed." }
        & codex plugin add $Plugin
        if ($LASTEXITCODE -ne 0) { Fail "plugin installation failed." }
        Write-Host ""
        Write-Host "Your keys stay on this computer in user-only files."
        Change-Keys "all"
    }
    "change" { Change-Keys $Target }
    "remove" { Remove-Keys $Target; exit 0 }
    "uninstall" { Uninstall-Plugin; exit 0 }
    "--keys-only" { Change-Keys "all" }
    "--remove-keys" { Remove-Keys "all"; exit 0 }
    "--dry-run" {
        Write-Host "codex plugin marketplace add $Marketplace"
        Write-Host "codex plugin add $Plugin"
        exit 0
    }
    default { Fail "unknown command: $Action" }
}

Write-Host ""
Write-Host "Done. Restart Codex and begin a new task."
