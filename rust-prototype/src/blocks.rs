use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::RwLock;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Block {
    pub id: String,
    pub min_col: u32,
    pub max_col: u32,
    pub min_row: u32,
    pub max_row: u32,
}

#[derive(Debug, Deserialize)]
pub struct BlockCreate {
    pub min_col: Option<u32>,
    pub max_col: Option<u32>,
    pub min_row: Option<u32>,
    pub max_row: Option<u32>,
    pub start_col: Option<u32>,
    pub start_row: Option<u32>,
    pub end_col: Option<u32>,
    pub end_row: Option<u32>,
}

impl BlockCreate {
    pub fn to_bounds(&self) -> Result<(u32, u32, u32, u32), &'static str> {
        let has_bounds = self.min_col.is_some() || self.max_col.is_some() || self.min_row.is_some() || self.max_row.is_some();
        let has_points = self.start_col.is_some() || self.start_row.is_some() || self.end_col.is_some() || self.end_row.is_some();

        if has_bounds && has_points {
            return Err("Provide either bounds fields or start/end fields, not both");
        }
        if !has_bounds && !has_points {
            return Err("Provide one complete block shape: bounds or start/end");
        }

        if has_bounds {
            let min_col = self.min_col.ok_or("Bounds shape requires min_col, max_col, min_row, max_row")?;
            let max_col = self.max_col.ok_or("Bounds shape requires min_col, max_col, min_row, max_row")?;
            let min_row = self.min_row.ok_or("Bounds shape requires min_col, max_col, min_row, max_row")?;
            let max_row = self.max_row.ok_or("Bounds shape requires min_col, max_col, min_row, max_row")?;

            if min_col > max_col || min_row > max_row {
                return Err("min_col must be <= max_col and min_row must be <= max_row");
            }
            Ok((min_col, max_col, min_row, max_row))
        } else {
            let start_col = self.start_col.ok_or("Start/end shape requires start_col, start_row, end_col, end_row")?;
            let start_row = self.start_row.ok_or("Start/end shape requires start_col, start_row, end_col, end_row")?;
            let end_col = self.end_col.ok_or("Start/end shape requires start_col, start_row, end_col, end_row")?;
            let end_row = self.end_row.ok_or("Start/end shape requires start_col, start_row, end_col, end_row")?;

            Ok((
                start_col.min(end_col),
                start_col.max(end_col),
                start_row.min(end_row),
                start_row.max(end_row),
            ))
        }
    }
}

pub struct BlockStore {
    blocks: RwLock<HashMap<String, Block>>,
}

impl BlockStore {
    pub fn new() -> Self {
        Self {
            blocks: RwLock::new(HashMap::new()),
        }
    }

    pub fn list(&self) -> Vec<Block> {
        let map = self.blocks.read().unwrap();
        map.values().cloned().collect()
    }

    pub fn create(&self, min_col: u32, max_col: u32, min_row: u32, max_row: u32) -> Block {
        let id = Uuid::new_v4().to_string();
        let block = Block {
            id: id.clone(),
            min_col,
            max_col,
            min_row,
            max_row,
        };
        self.blocks.write().unwrap().insert(id, block.clone());
        block
    }

    pub fn delete(&self, id: &str) -> bool {
        self.blocks.write().unwrap().remove(id).is_some()
    }

    pub fn clear(&self) {
        self.blocks.write().unwrap().clear();
    }
}
