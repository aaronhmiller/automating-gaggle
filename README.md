# automating-gaggle

Assumes the presence of a `.env` file containing your `USR` (username) and `PWD`
(password) for your GaggleAMP account.

## Usage

`deno run -A run-gaggle.ts`

## Installing
assuming you're starting from a bare VM:
* `sudo apt-get unzip`
* `curl -fsSL https://deno.land/install.sh | sh`
* `git clone <this_very_repo>`
* add the .env file
* `crontab -e`
* `06 */1 * * *  cd /root/automating-gaggle && /root/.deno/bin/deno run -A run-gaggle2.ts >> /root/gaggle-cron.log 2>&1`
