# Demo de Aex Prueba Pass Stellar 01 en testnet.
# Cada paso muestra el comando real del Stellar CLI, lo ejecuta al presionar
# Enter y traduce el resultado a lenguaje simple.
#
# Uso: doble clic en DEMO.cmd, o `pwsh -File demo.ps1`.
#   -Ensayo    la compra y los check-in solo se simulan (--send=no): no se envía nada.
#   -Contrato  otra instancia del contrato (por defecto, la primera, desplegada el 22/09/2026).
#
# Requisitos: Stellar CLI 28 y dos identidades del CLI:
#   anfitrion  la cuenta que desplegó el contrato (check_in exige su firma)
#   invitado   cualquier cuenta con XLM de prueba: stellar keys generate invitado --network testnet --fund
# En otra computadora no existe la llave del anfitrión original: despliega tu propia
# instancia (ver README) y pásala con -Contrato.
param(
    [switch]$Ensayo,
    [string]$Contrato = 'CCGIRQW6WUR4WT46DTL2EZMQBCY4SNRF622DN2VODMOYGMSFHMDPP6NW'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$env:STELLAR_NETWORK = 'testnet'

$comprador = 'invitado'
$anfitrion = 'anfitrion'
$interactivo = -not [Console]::IsInputRedirected

$errores = @{
    1 = 'InvalidPrice: precio inválido'
    2 = 'AlreadyBought: esta cuenta ya compró su pase'
    3 = 'NoPass: esta cuenta no tiene pase'
    4 = 'AlreadyUsed: este pase ya se usó'
}

if (-not (Get-Command stellar -ErrorAction SilentlyContinue)) {
    throw 'No encuentro el Stellar CLI. Instálalo con: winget install Stellar.StellarCLI'
}

function Direccion([string]$identidad) {
    $salida = & stellar keys address $identidad 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "No existe la identidad '$identidad' en el Stellar CLI. Créala con: stellar keys generate $identidad --network testnet --fund"
    }
    return "$salida".Trim()
}

$direccion = @{
    $anfitrion = Direccion $anfitrion
    $comprador = Direccion $comprador
}
$nombres = @{ $direccion[$anfitrion] = 'anfitrión'; $direccion[$comprador] = 'invitado' }

function Corto([string]$a) { $a.Substring(0, 4) + '…' + $a.Substring($a.Length - 4) }
function Quien([string]$a) { if ($nombres.ContainsKey($a)) { "$($nombres[$a]) ($(Corto $a))" } else { Corto $a } }
function Xlm([string]$stroops) { ([decimal]$stroops / 10000000).ToString('0.#######') + ' XLM' }

function Esperar {
    if (-not $interactivo) { return }
    Write-Host '  (Enter)' -ForegroundColor DarkGray -NoNewline
    do { $k = [Console]::ReadKey($true) } while ($k.Key -ne 'Enter')
    Write-Host "`r          `r" -NoNewline
}

function Titulo([string]$numero, [string]$texto, [string]$explicacion) {
    Write-Host ''
    Write-Host " PASO $numero · $texto" -ForegroundColor Cyan
    Write-Host "   $explicacion" -ForegroundColor Gray
    Esperar
}

# Ejecuta el comando y devuelve lo importante: código de salida, valor, link, error y eventos.
function Invocar([string]$firmante, [string[]]$funcion, [switch]$Escribe) {
    $argumentos = @('contract', 'invoke', '--id', $Contrato, '--source-account', $firmante)
    if ($Ensayo -and $Escribe) { $argumentos += '--send=no' }
    $argumentos += '--'
    $argumentos += $funcion
    Write-Host ('   $ stellar ' + ($argumentos -join ' ')) -ForegroundColor Yellow

    $r = @{ Ok = $false; Valor = $null; Tx = $null; Error = $null; Eventos = @(); Crudo = @() }
    $salida = & stellar @argumentos 2>&1
    $r.Ok = $LASTEXITCODE -eq 0
    foreach ($linea in $salida) {
        $l = "$linea"
        $r.Crudo += $l
        if (-not $r.Tx -and $l -match 'https://stellar\.expert/explorer/testnet/tx/[0-9a-f]{64}') {
            $r.Tx = $Matches[0]
        }
        elseif (-not $r.Error -and $l -match 'Error\(Contract, #(\d+)\)') {
            $r.Error = [int]$Matches[1]
        }
        elseif ($l -match '"symbol":"transfer"') {
            $ads = @([regex]::Matches($l, '"address":"([GC][A-Z2-7]{55})"') | ForEach-Object { $_.Groups[1].Value })
            $monto = if ($l -match '"i128":"(\d+)"') { $Matches[1] } else { '0' }
            if ($ads.Count -ge 2) {
                $r.Eventos += "Pago: $(Xlm $monto) de $(Quien $ads[0]) a $(Quien $ads[1])"
            }
        }
        elseif ($l -match "$Contrato - Success - Event: \w+ \((\w+)\)") {
            $r.Eventos += "Evento del contrato: $($Matches[1])"
        }
        elseif ($l -match '^\s*(null|"[^"]*"|-?\d+)\s*$') {
            $r.Valor = $Matches[1]
        }
    }
    # El CLI sale con código distinto de 0 cuando el contrato rechaza: se reporta
    # como rechazo si trae el código de error, y como fallo si no.
    return $r
}

function Resultado([string]$texto, [string]$color = 'Green') {
    Write-Host "   → $texto" -ForegroundColor $color
}

function Rechazo($r, [string]$color = 'Red') {
    Resultado "Rechazado por el contrato: error #$($r.Error) $($errores[$r.Error])" $color
}

function MostrarEventosYTx($r) {
    foreach ($e in $r.Eventos) { Write-Host "     · $e" -ForegroundColor Gray }
    if ($r.Tx) { Write-Host "     · Transacción: $($r.Tx)" -ForegroundColor DarkGray }
}

function FalloInesperado($r) {
    Resultado 'Algo salió distinto a lo esperado. Salida completa del CLI:' 'Red'
    $r.Crudo | ForEach-Object { Write-Host "     $_" -ForegroundColor DarkGray }
    $script:fallos++
}

$script:fallos = 0

# ------------------------------------------------------------------

if ($interactivo) { Clear-Host }
Write-Host ''
Write-Host ' AEX PRUEBA PASS STELLAR 01' -ForegroundColor Green
Write-Host ' Pase de acceso a un Meet · contrato Soroban en Stellar testnet' -ForegroundColor Green
Write-Host ''
Write-Host "   Contrato:   $(Corto $Contrato)"
Write-Host "   Anfitrión:  $(Corto $direccion[$anfitrion])  recibe el pago y controla la entrada"
Write-Host "   Invitado:   $(Corto $direccion[$comprador])  compra el pase y entra al Meet"
if ($Ensayo) { Write-Host '   MODO ENSAYO: la compra y los check-in solo se simulan, no se envía nada' -ForegroundColor Magenta }

Titulo '1' 'Datos del evento' 'Leo el nombre, el precio y el anfitrión guardados en el contrato.'
$n = Invocar $comprador @('name')
$p = Invocar $comprador @('price')
$h = Invocar $comprador @('host')
if (-not ($n.Ok -and $p.Ok -and $h.Ok -and $n.Valor -and $p.Valor -and $h.Valor)) {
    FalloInesperado $(if (-not $n.Ok) { $n } elseif (-not $p.Ok) { $p } else { $h })
    throw 'No pude leer el contrato. Revisa la red y el id del contrato.'
}
$precio = Xlm $p.Valor.Trim('"')
Resultado "Evento: $($n.Valor.Trim('"')) · Precio: $precio"
if ($h.Valor.Trim('"') -ne $direccion[$anfitrion]) {
    Resultado "Ojo: el anfitrión de este contrato es $(Corto $h.Valor.Trim('"')), no tu identidad '$anfitrion'. El check-in va a fallar por falta de firma." 'Yellow'
}

Titulo '2' '¿El invitado tiene pase?' 'Consulta de solo lectura: no envía ninguna transacción.'
$r = Invocar $comprador @('pass_of', '--buyer', $comprador)
if (-not $r.Ok) { FalloInesperado $r }
elseif ($r.Valor -eq 'null') { Resultado 'Todavía no tiene pase.' }
else { Resultado "Ya tiene pase, en estado $($r.Valor). La compra del paso 3 se va a rechazar con el error #2." 'Yellow' }

Titulo '3' 'El invitado compra su pase' "El invitado firma. El contrato le cobra $precio, se lo paga al anfitrión y registra su pase."
$compra = Invocar $comprador @('buy', '--buyer', $comprador) -Escribe
if ($compra.Error) { Rechazo $compra }
elseif (-not $compra.Ok) { FalloInesperado $compra }
elseif ($Ensayo) { Resultado 'Compra simulada: saldría bien. No se envió, así que el invitado sigue sin pase.'; MostrarEventosYTx $compra }
elseif ($compra.Tx) { Resultado 'Compra confirmada: el invitado ya tiene su pase.'; MostrarEventosYTx $compra }
else { FalloInesperado $compra }

Titulo '4' 'El anfitrión lo deja entrar al Meet' 'Solo el anfitrión puede firmar el check-in. El pase pasa de comprado (Bought) a usado (Used).'
$entrada = Invocar $anfitrion @('check_in', '--buyer', $comprador) -Escribe
if ($Ensayo -and $entrada.Error -eq 3) {
    Rechazo $entrada 'Yellow'
    Write-Host '     · Es lo esperado en el ensayo: la compra no se envió, y el contrato no deja entrar a quien no compró.' -ForegroundColor Gray
}
elseif ($entrada.Error) { Rechazo $entrada }
elseif (-not $entrada.Ok) { FalloInesperado $entrada }
elseif ($Ensayo) { Resultado 'Check-in simulado: saldría bien (no se envió).'; MostrarEventosYTx $entrada }
elseif ($entrada.Tx) { Resultado 'Entrada registrada: el pase ya está usado.'; MostrarEventosYTx $entrada }
else { FalloInesperado $entrada }

Titulo '5' 'Intento de entrar otra vez con el mismo pase' 'Es el mismo comando del paso 4.'
if ($Ensayo) {
    Resultado 'En el ensayo no se repite: el check-in del paso 4 no se envió, así que el pase no llegó a usarse.' 'Yellow'
}
else {
    $otra = Invocar $anfitrion @('check_in', '--buyer', $comprador) -Escribe
    if ($otra.Error -eq 4) {
        Rechazo $otra
        Write-Host '     · La simulación falló, así que la transacción no se envió a la red.' -ForegroundColor Gray
    }
    elseif ($otra.Error) { Rechazo $otra; $script:fallos++ }
    elseif ($otra.Tx) { Resultado 'Se aceptó un segundo check-in: esto no debería pasar.' 'Red'; $script:fallos++ }
    else { FalloInesperado $otra }
}

Titulo '6' 'Estado final del pase' 'Otra consulta de solo lectura.'
$r = Invocar $comprador @('pass_of', '--buyer', $comprador)
switch ($r.Valor) {
    '"Used"' { Resultado 'Used: el pase ya se usó.' }
    '"Bought"' { Resultado 'Bought: comprado, todavía sin usar.' 'Yellow' }
    'null' { Resultado 'Sin pase.' 'Yellow' }
    default { FalloInesperado $r }
}

if ($interactivo) {
    Write-Host ''
    Write-Host ' Ver todo en el explorador (stellar.expert)' -ForegroundColor Cyan
    Write-Host '   Se abren la compra, el check-in (si se enviaron) y el storage del contrato.' -ForegroundColor Gray
    Esperar
    $tx = @($compra.Tx, $entrada.Tx) | Where-Object { $_ }
    foreach ($url in @($tx) + "https://stellar.expert/explorer/testnet/contract/$Contrato/storage") {
        Start-Process $url
        Start-Sleep -Milliseconds 700
    }
}

if ($script:fallos -gt 0) {
    Write-Host ''
    Write-Host " $($script:fallos) paso(s) salieron distinto a lo esperado." -ForegroundColor Red
    exit 1
}
