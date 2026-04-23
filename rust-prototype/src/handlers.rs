use actix_web::{web, HttpResponse, Result};

use crate::grid::GridConfig;
use crate::blocks::{BlockStore, BlockCreate};

pub async fn index() -> Result<HttpResponse> {
    let html = include_str!("../static/index.html");
    Ok(HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(html))
}

pub async fn api_grid(config: web::Data<GridConfig>) -> Result<HttpResponse> {
    Ok(HttpResponse::Ok()
        .content_type("application/json")
        .json(config.as_ref()))
}

pub async fn static_file(path: web::Path<String>) -> Result<HttpResponse> {
    match path.as_str() {
        "notebook.js" => {
            let js = include_str!("../static/notebook.js");
            Ok(HttpResponse::Ok()
                .content_type("application/javascript")
                .body(js))
        }
        _ => Ok(HttpResponse::NotFound().body("Not found")),
    }
}

pub async fn api_blocks_list(store: web::Data<BlockStore>) -> Result<HttpResponse> {
    let blocks = store.list();
    Ok(HttpResponse::Ok().json(blocks))
}

pub async fn api_blocks_create(
    store: web::Data<BlockStore>,
    config: web::Data<GridConfig>,
    payload: web::Json<BlockCreate>,
) -> Result<HttpResponse> {
    match payload.to_bounds() {
        Ok((min_col, max_col, min_row, max_row)) => {
            if min_col < config.margin_cols {
                return Ok(HttpResponse::UnprocessableEntity().body(format!("min_col must be >= margin_cols ({})", config.margin_cols)));
            }
            let block = store.create(min_col, max_col, min_row, max_row);
            Ok(HttpResponse::Created().json(block))
        }
        Err(e) => Ok(HttpResponse::UnprocessableEntity().body(e)),
    }
}

pub async fn api_blocks_delete(
    store: web::Data<BlockStore>,
    path: web::Path<String>,
) -> Result<HttpResponse> {
    let id = path.into_inner();
    if store.delete(&id) {
        Ok(HttpResponse::NoContent().finish())
    } else {
        Ok(HttpResponse::NotFound().body("Block not found"))
    }
}

pub async fn api_blocks_clear(store: web::Data<BlockStore>) -> Result<HttpResponse> {
    store.clear();
    Ok(HttpResponse::NoContent().finish())
}
