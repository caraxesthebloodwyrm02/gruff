use actix_web::{web, App, HttpServer, middleware};
use clap::Parser;
use tracing::info;

mod grid;
mod handlers;
mod blocks;

use grid::GridConfig;
use blocks::BlockStore;

#[derive(Parser)]
#[command(name = "notebook-engine")]
#[command(about = "A modern physical notebook drawing tool", long_about = None)]
struct Cli {
    #[arg(long, default_value = "127.0.0.1")]
    host: String,

    #[arg(long, default_value_t = 8080)]
    port: u16,

    #[arg(long, default_value_t = 24)]
    cell_px: u32,

    #[arg(long, default_value_t = 2)]
    margin_cols: u32,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let cli = Cli::parse();

    tracing_subscriber::fmt()
        .with_env_filter("info")
        .with_target(true)
        .init();

    let config = GridConfig {
        cell_px: cli.cell_px,
        margin_cols: cli.margin_cols,
    };

    let block_store = web::Data::new(BlockStore::new());

    info!(
        cell_px = config.cell_px,
        margin_cols = config.margin_cols,
        "notebook-engine starting"
    );

    let bind_addr = format!("{}:{}", cli.host, cli.port);
    info!("listening on http://{}", bind_addr);

    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(config.clone()))
            .app_data(block_store.clone())
            .wrap(middleware::Logger::default())
            .wrap(actix_cors::Cors::permissive())
            .route("/", web::get().to(handlers::index))
            .route("/api/grid", web::get().to(handlers::api_grid))
            .route("/api/blocks", web::get().to(handlers::api_blocks_list))
            .route("/api/blocks", web::post().to(handlers::api_blocks_create))
            .route("/api/blocks/{id}", web::delete().to(handlers::api_blocks_delete))
            .route("/api/blocks/clear", web::post().to(handlers::api_blocks_clear))
            .route("/static/{file}", web::get().to(handlers::static_file))
    })
    .bind(&bind_addr)?
    .run()
    .await
}
